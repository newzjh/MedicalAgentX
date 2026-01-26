import React, { useState, useEffect, useMemo } from 'react';
import classnames from 'classnames';
import PropTypes from 'prop-types';
import { Link, useNavigate } from 'react-router-dom';
import moment from 'moment';
import qs from 'query-string';
import isEqual from 'lodash.isequal';
import { useTranslation } from 'react-i18next';
//
import filtersMeta from './filtersMeta.js';
import { useAppConfig } from '@state';
import useWorkflowHistoryStore from '@state/useWorkflowHistoryStore';
import { useDebounce, useSearchParams, useOrientation } from '../../hooks';
import { utils, Types as coreTypes } from '@ohif/core';

import {
  StudyListExpandedRow,
  EmptyStudies,
  StudyListTable,
  StudyListPagination,
  StudyListFilter,
  Button,
  ButtonEnums,
  Types,
} from '@ohif/ui';

import {
  Header,
  Icons,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  Clipboard,
  useModal,
  useSessionStorage,
  Onboarding,
  ScrollArea,
  InvestigationalUseDialog,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@ohif/ui-next';

import { preserveQueryParameters, preserveQueryStrings } from '../../utils/preserveQueryParameters';

// Custom components
import AIAssistant from '../../components/AIAssistant/AIAssistant';
import WorkflowHistory from '../../components/WorkflowHistory/WorkflowHistory';
import DoctorList from '../../components/DoctorList/DoctorList';

interface Session {
  id: string;
  type: 'ai' | 'doctor';
  doctorId?: string;
  doctorName?: string;
  messages: Array<{
    id: string;
    text: string;
    isUser: boolean;
    timestamp: string;
  }>;
  associatedImage?: string;
}

interface Doctor {
  id: string;
  name: string;
  hospital: string;
  department: string;
  description: string;
}

interface MedicalReport {
  id: string;
  title: string;
  createdAt: string;
  associatedImage?: string;
  content: {
    // 患者基本信息
    patientName: string;
    patientGender: string;
    patientAge: string;
    outpatientNo: string;
    imageNo: string;
    department: string;
    ward: string;
    bedNo: string;
    
    // 检查信息
    examinationEquipment: string;
    examinationDate: string;
    examinationTime: string;
    examinationName: string;
    clinicalDiagnosis: string;
    chiefComplaint: string;
    
    // 影像信息
    imageManifestation: string;
    imageDiagnosis: string;
    
    // 报告信息
    diagnosticPerson: string;
    reviewPerson: string;
    reportDate: string;
    reportTime: string;
    reportStatus: string;
    
    // 其他信息
    analysisTechnology: string;
    findings: string;
    recommendations: string;
    studyInformation: string;
    conclusion: string;
    remarks: string;
  };
}

const PatientInfoVisibility = Types.PatientInfoVisibility;

const { sortBySeriesDate } = utils;

const seriesInStudiesMap = new Map();

/**
 * TODO:
 * - debounce `setFilterValues` (150ms?)
 */
function WorkList({
  data: studies,
  dataTotal: studiesTotal,
  isLoadingData,
  dataSource,
  hotkeysManager,
  dataPath,
  onRefresh,
  servicesManager,
}: withAppTypes) {
  const { show, hide } = useModal();
  const { t } = useTranslation();
  // ~ Modes
  const [appConfig] = useAppConfig();
  // ~ Filters
  const searchParams = useSearchParams();
  const navigate = useNavigate();
  const STUDIES_LIMIT = 101;
  const queryFilterValues = _getQueryFilterValues(searchParams);
  const [sessionQueryFilterValues, updateSessionQueryFilterValues] = useSessionStorage({
    key: 'queryFilterValues',
    defaultValue: queryFilterValues,
    // ToDo: useSessionStorage currently uses an unload listener to clear the filters from session storage
    // so on systems that do not support unload events a user will NOT be able to alter any existing filter
    // in the URL, load the page and have it apply.
    clearOnUnload: true,
  });
  const [filterValues, _setFilterValues] = useState({
    ...defaultFilterValues,
    ...sessionQueryFilterValues,
  });

  // Screen orientation detection
  const { isPortrait, isLandscape } = useOrientation();

  const debouncedFilterValues = useDebounce(filterValues, 200);
  const { resultsPerPage, pageNumber, sortBy, sortDirection } = filterValues;

  // Tab state
  const [activeTab, setActiveTab] = useState('studies');
  // Workflow history state from Zustand store
  const { workflowHistory, addWorkflowItem, clearWorkflowHistory } = useWorkflowHistoryStore();
  // Drag state for tab navigation
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);

  // Session management state
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [associatedImage, setAssociatedImage] = useState<string | undefined>();

  // Reports management state
  const [reports, setReports] = useState<MedicalReport[]>([]);
  const [selectedReport, setSelectedReport] = useState<MedicalReport | null>(null);
  const [showReportDialog, setShowReportDialog] = useState(false);

  // Cookie utility functions
  const getCookie = (name: string): string | null => {
    const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
    return match ? match[2] : null;
  };

  const setCookie = (name: string, value: string, days: number = 7): void => {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    const expires = `expires=${date.toUTCString()}`;
    document.cookie = `${name}=${value}; ${expires}; path=/`;
  };

  // Load sessions from cookie on component mount
  useEffect(() => {
    const savedSessions = getCookie('chatSessions');
    if (savedSessions) {
      try {
        const parsedSessions = JSON.parse(savedSessions);
        setSessions(parsedSessions);
        // Set current session to AI session by default
        const aiSession = parsedSessions.find((s: Session) => s.type === 'ai');
        if (aiSession) {
          setCurrentSession(aiSession);
        }
      } catch (error) {
        console.error('Error parsing saved sessions:', error);
      }
    } else {
      // Create default AI session if no sessions exist
      const defaultAISession: Session = {
        id: 'ai-default',
        type: 'ai',
        messages: [],
      };
      setSessions([defaultAISession]);
      setCurrentSession(defaultAISession);
    }
  }, []);

  // Save sessions to cookie when sessions change
  useEffect(() => {
    if (sessions.length > 0) {
      setCookie('chatSessions', JSON.stringify(sessions));
    }
  }, [sessions]);

  // Handle doctor selection from DoctorList component
  const handleDoctorSelect = (doctor: Doctor) => {
    setSelectedDoctor(doctor);

    // Check if a session already exists for this doctor
    let doctorSession = sessions.find((s: Session) => s.type === 'doctor' && s.doctorId === doctor.id);

    if (!doctorSession) {
      // Create new session for this doctor
      doctorSession = {
        id: `doctor-${doctor.id}`,
        type: 'doctor',
        doctorId: doctor.id,
        doctorName: doctor.name,
        messages: [],
        associatedImage: associatedImage,
      };
      setSessions([...sessions, doctorSession]);
    } else {
      // Update associated image if it's not set
      if (!doctorSession.associatedImage && associatedImage) {
        doctorSession = {
          ...doctorSession,
          associatedImage: associatedImage,
        };
        setSessions(sessions.map(s => s.id === doctorSession!.id ? doctorSession! : s));
      }
    }

    // Switch to AI Assistant tab and set current session
    setCurrentSession(doctorSession);
    setActiveTab('assistant');
  };

  // Handle session message update
  const handleSessionUpdate = (sessionId: string, messages: Session['messages']) => {
    setSessions(sessions.map(session => {
      if (session.id === sessionId) {
        return {
          ...session,
          messages,
        };
      }
      return session;
    }));

    // Update current session if it's the one being updated
    if (currentSession && currentSession.id === sessionId) {
      setCurrentSession(prev => prev ? { ...prev, messages } : null);
    }
  };

  // Handle AI session selection
  const handleAISessionSelect = () => {
    // Check if AI session exists
    let aiSession = sessions.find((s: Session) => s.type === 'ai');

    if (!aiSession) {
      // Create new AI session
      aiSession = {
        id: 'ai-default',
        type: 'ai',
        messages: [],
        associatedImage: associatedImage,
      };
      setSessions([...sessions, aiSession]);
    } else {
      // Update associated image if it's not set
      if (!aiSession.associatedImage && associatedImage) {
        aiSession = {
          ...aiSession,
          associatedImage: associatedImage,
        };
        setSessions(sessions.map(s => s.id === aiSession!.id ? aiSession! : s));
      }
    }

    setCurrentSession(aiSession);
  };

  // Tab order for navigation
  const tabOrder = ['studies', 'assistant', 'workflow', 'consultation', 'reports'];

  // Handle drag start
  const handleDragStart = (e) => {
    // Only start drag if mouse is near left or right edge (within 50px)
    if (e.clientX < 50 || e.clientX > window.innerWidth - 50) {
      setIsDragging(true);
      setStartX(e.clientX);
    }
  };

  // Handle drag move
  const handleDragMove = (e) => {
    if (!isDragging) return;

    const currentX = e.clientX;
    const diffX = currentX - startX;

    // If dragged more than 100px, switch tabs
    if (Math.abs(diffX) > 100) {
      const currentIndex = tabOrder.indexOf(activeTab);
      let newIndex;

      if (diffX > 0) {
        // Swipe right - go to previous tab
        newIndex = currentIndex > 0 ? currentIndex - 1 : tabOrder.length - 1;
      } else {
        // Swipe left - go to next tab
        newIndex = currentIndex < tabOrder.length - 1 ? currentIndex + 1 : 0;
      }

      setActiveTab(tabOrder[newIndex]);
      setIsDragging(false);
    }
  };

  // Handle drag end
  const handleDragEnd = () => {
    setIsDragging(false);
  };

  // Add drag event listeners
  useEffect(() => {
    window.addEventListener('mousedown', handleDragStart);
    window.addEventListener('mousemove', handleDragMove);
    window.addEventListener('mouseup', handleDragEnd);
    window.addEventListener('mouseleave', handleDragEnd);

    return () => {
      window.removeEventListener('mousedown', handleDragStart);
      window.removeEventListener('mousemove', handleDragMove);
      window.removeEventListener('mouseup', handleDragEnd);
      window.removeEventListener('mouseleave', handleDragEnd);
    };
  }, [isDragging, activeTab]);

  /*
   * The default sort value keep the filters synchronized with runtime conditional sorting
   * Only applied if no other sorting is specified and there are less than 101 studies
   */

  const canSort = studiesTotal < STUDIES_LIMIT;
  const shouldUseDefaultSort = sortBy === '' || !sortBy;
  const sortModifier = sortDirection === 'descending' ? 1 : -1;
  const defaultSortValues =
    shouldUseDefaultSort && canSort ? { sortBy: 'studyDate', sortDirection: 'ascending' } : {};
  const { customizationService } = servicesManager.services;

  const sortedStudies = useMemo(() => {
    if (!canSort) {
      return studies;
    }

    return [...studies].sort((s1, s2) => {
      if (shouldUseDefaultSort) {
        const ascendingSortModifier = -1;
        return _sortStringDates(s1, s2, ascendingSortModifier);
      }

      const s1Prop = s1[sortBy];
      const s2Prop = s2[sortBy];

      if (typeof s1Prop === 'string' && typeof s2Prop === 'string') {
        return s1Prop.localeCompare(s2Prop) * sortModifier;
      } else if (typeof s1Prop === 'number' && typeof s2Prop === 'number') {
        return (s1Prop > s2Prop ? 1 : -1) * sortModifier;
      } else if (!s1Prop && s2Prop) {
        return -1 * sortModifier;
      } else if (!s2Prop && s1Prop) {
        return 1 * sortModifier;
      } else if (sortBy === 'studyDate') {
        return _sortStringDates(s1, s2, sortModifier);
      }

      return 0;
    });
  }, [canSort, studies, shouldUseDefaultSort, sortBy, sortModifier]);

  // ~ Rows & Studies
  const [expandedRows, setExpandedRows] = useState([]);
  const [studiesWithSeriesData, setStudiesWithSeriesData] = useState([]);
  const numOfStudies = studiesTotal;
  const querying = useMemo(() => {
    return isLoadingData || expandedRows.length > 0;
  }, [isLoadingData, expandedRows]);

  const setFilterValues = val => {
    if (filterValues.pageNumber === val.pageNumber) {
      val.pageNumber = 1;
    }
    _setFilterValues(val);
    updateSessionQueryFilterValues(val);
    setExpandedRows([]);
  };

  const onPageNumberChange = newPageNumber => {
    const oldPageNumber = filterValues.pageNumber;
    const rollingPageNumberMod = Math.floor(101 / filterValues.resultsPerPage);
    const rollingPageNumber = oldPageNumber % rollingPageNumberMod;
    const isNextPage = newPageNumber > oldPageNumber;
    const hasNextPage = Math.max(rollingPageNumber, 1) * resultsPerPage < numOfStudies;

    if (isNextPage && !hasNextPage) {
      return;
    }

    setFilterValues({ ...filterValues, pageNumber: newPageNumber });
  };

  const onResultsPerPageChange = newResultsPerPage => {
    setFilterValues({
      ...filterValues,
      pageNumber: 1,
      resultsPerPage: Number(newResultsPerPage),
    });
  };

  // Set body style
  useEffect(() => {
    document.body.classList.add('bg-white');
    return () => {
      document.body.classList.remove('bg-white');
    };
  }, []);

  // Sync URL query parameters with filters
  useEffect(() => {
    if (!debouncedFilterValues) {
      return;
    }

    const queryString = {};
    Object.keys(defaultFilterValues).forEach(key => {
      const defaultValue = defaultFilterValues[key];
      const currValue = debouncedFilterValues[key];

      // TODO: nesting/recursion?
      if (key === 'studyDate') {
        if (currValue.startDate && defaultValue.startDate !== currValue.startDate) {
          queryString.startDate = currValue.startDate;
        }
        if (currValue.endDate && defaultValue.endDate !== currValue.endDate) {
          queryString.endDate = currValue.endDate;
        }
      } else if (key === 'modalities' && currValue.length) {
        queryString.modalities = currValue.join(',');
      } else if (currValue !== defaultValue) {
        queryString[key] = currValue;
      }
    });

    preserveQueryStrings(queryString);

    const search = qs.stringify(queryString, {
      skipNull: true,
      skipEmptyString: true,
    });
    navigate({
      pathname: '/',
      search: search ? `?${search}` : undefined,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedFilterValues]);

  // Query for series information
  useEffect(() => {
    const fetchSeries = async studyInstanceUid => {
      try {
        const series = await dataSource.query.series.search(studyInstanceUid);
        seriesInStudiesMap.set(studyInstanceUid, sortBySeriesDate(series));
        setStudiesWithSeriesData([...studiesWithSeriesData, studyInstanceUid]);
      } catch (ex) {
        // TODO: UI Notification Service
        console.warn(ex);
      }
    };

    // TODO: WHY WOULD YOU USE AN INDEX OF 1?!
    // Note: expanded rows index begins at 1
    for (let z = 0; z < expandedRows.length; z++) {
      const expandedRowIndex = expandedRows[z] - 1;
      const studyInstanceUid = sortedStudies[expandedRowIndex].studyInstanceUid;

      if (studiesWithSeriesData.includes(studyInstanceUid)) {
        continue;
      }

      fetchSeries(studyInstanceUid);
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandedRows, studies]);

  const isFiltering = (filterValues, defaultFilterValues) => {
    return !isEqual(filterValues, defaultFilterValues);
  };

  const rollingPageNumberMod = Math.floor(101 / resultsPerPage);
  const rollingPageNumber = (pageNumber - 1) % rollingPageNumberMod;
  const offset = resultsPerPage * rollingPageNumber;
  const offsetAndTake = offset + resultsPerPage;
  // Handle image association when study is opened
  const handleImageAssociation = (studyInstanceUid: string, studyDescription: string) => {
    const imageInfo = `${studyDescription} (${studyInstanceUid})`;
    setAssociatedImage(imageInfo);

    // Update all sessions that don't have an associated image yet
    setSessions(sessions.map(session => {
      if (!session.associatedImage) {
        return {
          ...session,
          associatedImage: imageInfo,
        };
      }
      return session;
    }));

    // Update current session if it exists and doesn't have an associated image
    if (currentSession && !currentSession.associatedImage) {
      setCurrentSession(prev => prev ? {
        ...prev,
        associatedImage: imageInfo,
      } : null);
    }
  };

  // Handle report item click to open details dialog
  const handleReportClick = (report: MedicalReport) => {
    setSelectedReport(report);
    setShowReportDialog(true);
  };

  // Close report details dialog
  const handleCloseReportDialog = () => {
    setShowReportDialog(false);
    setSelectedReport(null);
  };

  const tableDataSource = sortedStudies.map((study, key) => {
    const rowKey = key + 1;
    const isExpanded = expandedRows.some(k => k === rowKey);
    const {
      studyInstanceUid,
      accession,
      modalities,
      instances,
      description,
      mrn,
      patientName,
      date,
      time,
    } = study;
    const studyDate = date && moment(date, ['YYYYMMDD', 'YYYY.MM.DD'], true).isValid() && moment(date, ['YYYYMMDD', 'YYYY.MM.DD']).format(t('Common:localDateFormat', 'MMM-DD-YYYY'));
    const studyTime = time && moment(time, ['HH', 'HHmm', 'HHmmss', 'HHmmss.SSS']).isValid() && moment(time, ['HH', 'HHmm', 'HHmmss', 'HHmmss.SSS']).format(t('Common:localTimeFormat', 'hh:mm A'));

    const makeCopyTooltipCell = textValue => {
      if (!textValue) {
        return '';
      }
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="cursor-pointer truncate">{textValue}</span>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <div className="flex items-center justify-between gap-2">
              {textValue}
              <Clipboard>{textValue}</Clipboard>
            </div>
          </TooltipContent>
        </Tooltip>
      );
    };

    // Build row columns based on orientation
    const rowColumns = [
      {
        key: 'patientName',
        content: patientName ? makeCopyTooltipCell(patientName) : null,
        gridCol: 4,
      },
      {
        key: 'studyDate',
        content: (
          <>
            {studyDate && <span className="mr-4">{studyDate}</span>}
            {studyTime && <span>{studyTime}</span>}
          </>
        ),
        title: `${studyDate || ''} ${studyTime || ''}`,
        gridCol: 5,
      },
      {
        key: 'modality',
        content: modalities,
        title: modalities,
        gridCol: 3,
      },
      {
        key: 'instances',
        content: (
          <>
            <Icons.ViewportViews
              className={classnames('mr-2 inline-flex w-4', {
                'text-primary': isExpanded,
                'text-secondary-light': !isExpanded,
              })}
            />
            {instances}
          </>
        ),
        title: (instances || 0).toString(),
        gridCol: 2,
      },
    ];

    // Add columns that are only shown in landscape mode
    if (isLandscape) {
      // Insert MRN column after patientName
      rowColumns.splice(1, 0, {
        key: 'mrn',
        content: makeCopyTooltipCell(mrn),
        gridCol: 3,
      });

      // Insert description column after studyDate
      rowColumns.splice(3, 0, {
        key: 'description',
        content: makeCopyTooltipCell(description),
        gridCol: 4,
      });

      // Insert accession column after modality
      rowColumns.splice(5, 0, {
        key: 'accession',
        content: makeCopyTooltipCell(accession),
        gridCol: 3,
      });
    }

    return {
      dataCY: `studyRow-${studyInstanceUid}`,
      clickableCY: studyInstanceUid,
      row: rowColumns,
      // Todo: This is actually running for all rows, even if they are
      // not clicked on.
      expandedContent: (
        <StudyListExpandedRow
          seriesTableColumns={{
            description: t('StudyList:Description'),
            seriesNumber: t('StudyList:Series'),
            modality: t('StudyList:Modality'),
            instances: t('StudyList:Instances'),
          }}
          seriesTableDataSource={
            seriesInStudiesMap.has(studyInstanceUid)
              ? seriesInStudiesMap.get(studyInstanceUid).map(s => {
                  return {
                    description: s.description || '(empty)',
                    seriesNumber: s.seriesNumber ?? '',
                    modality: s.modality || '',
                    instances: s.numSeriesInstances || '',
                  };
                })
              : []
          }
        >
          <div className="flex flex-row gap-2">
            {(appConfig.groupEnabledModesFirst
              ? appConfig.loadedModes.sort((a, b) => {
                  const isValidA = a.isValidMode({
                    modalities: modalities.replaceAll('/', '\\'),
                    study,
                  }).valid;
                  const isValidB = b.isValidMode({
                    modalities: modalities.replaceAll('/', '\\'),
                    study,
                  }).valid;

                  return isValidB - isValidA;
                })
              : appConfig.loadedModes
            ).map((mode, i) => {
              if (mode.hide) {
                // Hide this mode from display
                return null;
              }
              const modalitiesToCheck = modalities.replaceAll('/', '\\');

              const { valid: isValidMode, description: invalidModeDescription } = mode.isValidMode({
                modalities: modalitiesToCheck,
                study,
              });
              if (isValidMode === null) {
                // Hide this as a computed result.
                return null;
              }

              // TODO: Modes need a default/target route? We mostly support a single one for now.
              // We should also be using the route path, but currently are not
              // mode.routeName
              // mode.routes[x].path
              // Don't specify default data source, and it should just be picked up... (this may not currently be the case)
              // How do we know which params to pass? Today, it's just StudyInstanceUIDs and configUrl if exists
              const query = new URLSearchParams();
              if (filterValues.configUrl) {
                query.append('configUrl', filterValues.configUrl);
              }
              query.append('StudyInstanceUIDs', studyInstanceUid);
              preserveQueryParameters(query);

              return (
                mode.displayName && (
                  <Link
                    className={isValidMode ? '' : 'cursor-not-allowed'}
                    key={i}
                    to={`${mode.routeName}${dataPath || ''}?${query.toString()}`}
                    onClick={event => {
                      // In case any event bubbles up for an invalid mode, prevent the navigation.
                      // For example, the event bubbles up when the icon embedded in the disabled button is clicked.
                      if (!isValidMode) {
                        event.preventDefault();
                      } else {
                        // Associate the image with the current session when opened
                        handleImageAssociation(studyInstanceUid, description);
                      }
                    }}
                    // to={`${mode.routeName}/dicomweb?StudyInstanceUIDs=${studyInstanceUid}`}
                  >
                    {/* TODO revisit the completely rounded style of buttons used for launching a mode from the worklist later */}
                    <Button
                      type={ButtonEnums.type.primary}
                      size={ButtonEnums.size.small}
                      disabled={!isValidMode}
                      startIconTooltip={
                        !isValidMode ? (
                          <div className="font-inter flex w-[206px] whitespace-normal text-left text-xs font-normal text-white">
                            {invalidModeDescription}
                          </div>
                        ) : null
                      }
                      startIcon={
                        isValidMode ? (
                          <Icons.LaunchArrow className="!h-[20px] !w-[20px] text-black" />
                        ) : (
                          <Icons.LaunchInfo className="!h-[20px] !w-[20px] text-black" />
                        )
                      }
                      onClick={() => {}}
                      dataCY={`mode-${mode.routeName}-${studyInstanceUid}`}
                      className={!isValidMode ? 'bg-[#222d44]' : ''}
                    >
                      {mode.displayName}
                    </Button>
                  </Link>
                )
              );
            })}
          </div>
        </StudyListExpandedRow>
      ),
      onClickRow: () =>
        setExpandedRows(s => (isExpanded ? s.filter(n => rowKey !== n) : [...s, rowKey])),
      isExpanded,
    };
  });

  const hasStudies = numOfStudies > 0;

  const AboutModal = customizationService.getCustomization(
    'ohif.aboutModal'
  ) as coreTypes.MenuComponentCustomization;
  const UserPreferencesModal = customizationService.getCustomization(
    'ohif.userPreferencesModal'
  ) as coreTypes.MenuComponentCustomization;

  const menuOptions = [
    {
      title: AboutModal?.menuTitle ?? t('Header:About'),
      icon: 'info',
      onClick: () =>
        show({
          content: AboutModal,
          title: AboutModal?.title ?? '多维智能医学影像智能体',
          containerClassName: AboutModal?.containerClassName ?? 'max-w-md',
        }),
    },
    {
      title: UserPreferencesModal.menuTitle ?? t('Header:Preferences'),
      icon: 'settings',
      onClick: () =>
        show({
          content: UserPreferencesModal as React.ComponentType,
          title: UserPreferencesModal.title ?? t('UserPreferencesModal:User preferences'),
          containerClassName:
            UserPreferencesModal?.containerClassName ?? 'flex max-w-4xl p-6 flex-col',
        }),
    },
  ];

  if (appConfig.oidc) {
    menuOptions.push({
      icon: 'power-off',
      title: t('Header:Logout'),
      onClick: () => {
        navigate(`/logout?redirect_uri=${encodeURIComponent(window.location.href)}`);
      },
    });
  }

  const LoadingIndicatorProgress = customizationService.getCustomization(
    'ui.loadingIndicatorProgress'
  );
  const DicomUploadComponent = customizationService.getCustomization('dicomUploadComponent');

  const uploadProps =
    DicomUploadComponent && dataSource.getConfig()?.dicomUploadEnabled
      ? {
          title: 'Upload files',
          containerClassName: DicomUploadComponent?.containerClassName,
          closeButton: true,
          shouldCloseOnEsc: false,
          shouldCloseOnOverlayClick: false,
          content: () => (
            <DicomUploadComponent
              dataSource={dataSource}
              onComplete={() => {
                hide();
                onRefresh();
              }}
              onStarted={() => {
                show({
                  ...uploadProps,
                  // when upload starts, hide the default close button as closing the dialogue must be handled by the upload dialogue itself
                  closeButton: false,
                });
              }}
            />
          ),
        }
      : undefined;

  const dataSourceConfigurationComponent = customizationService.getCustomization(
    'ohif.dataSourceConfigurationComponent'
  );

  return (
    <div className="flex h-screen flex-col bg-white">
      <Header
        isSticky
        menuOptions={menuOptions}
        isReturnEnabled={false}
        WhiteLabeling={appConfig.whiteLabeling}
        showPatientInfo={PatientInfoVisibility.DISABLED}
        Secondary={
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="h-7 bg-transparent">
              <TabsTrigger value="studies" className="text-xs px-2 py-0.5 text-gray-900">
                <Icons.TabStudies className="mr-1 h-3 w-3" />
                {t('StudyList:Study List')}
              </TabsTrigger>
              <TabsTrigger value="assistant" className="text-xs px-2 py-0.5 text-gray-900">
                <Icons.Info className="mr-1 h-3 w-3" />
                {t('WorkList:AI Assistant')}
              </TabsTrigger>
              <TabsTrigger value="workflow" className="text-xs px-2 py-0.5 text-gray-900">
                <Icons.StatusTracking className="mr-1 h-3 w-3" />
                {t('WorkList:Workflow')}
              </TabsTrigger>
              <TabsTrigger value="consultation" className="text-xs px-2 py-0.5 text-gray-900">
                <Icons.MultiplePatients className="mr-1 h-3 w-3" />
                {t('WorkList:Consultation')}
              </TabsTrigger>
              <TabsTrigger value="reports" className="text-xs px-2 py-0.5 text-gray-900">
                <Icons.Download className="mr-1 h-3 w-3" />
                {t('WorkList:Reports')}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        }
      />
      <Onboarding />
      <InvestigationalUseDialog dialogConfiguration={appConfig?.investigationalUseDialog} />
      <div className="flex h-full flex-col overflow-y-auto">
        <ScrollArea>
          <div className="flex grow flex-col">
            <Tabs value={activeTab} onValueChange={setActiveTab}>

              {/* Study List Tab */}
              <TabsContent value="studies" className="flex grow flex-col">
                <StudyListFilter
                  numOfStudies={pageNumber * resultsPerPage > 100 ? 101 : numOfStudies}
                  filtersMeta={isLandscape ? filtersMeta : filtersMeta.filter(filter => {
                    // Hide MRN, Description, and Accession columns in portrait mode
                    return !['mrn', 'description', 'accession'].includes(filter.name);
                  })}
                  filterValues={{ ...filterValues, ...defaultSortValues }}
                  onChange={setFilterValues}
                  clearFilters={() => setFilterValues(defaultFilterValues)}
                  isFiltering={isFiltering(filterValues, defaultFilterValues)}
                  onUploadClick={uploadProps ? () => show(uploadProps) : undefined}
                  getDataSourceConfigurationComponent={
                    dataSourceConfigurationComponent
                      ? () => dataSourceConfigurationComponent()
                      : undefined
                  }
                />
                <div className="flex justify-center gap-2 p-4">
                  <Button
                    type={ButtonEnums.type.primary}
                    size={ButtonEnums.size.small}
                    onClick={() => navigate('/local?type=dicom')}
                    startIcon={<Icons.Upload />}
                  >
                    Load DICOM Files
                  </Button>
                  <Button
                    type={ButtonEnums.type.primary}
                    size={ButtonEnums.size.small}
                    onClick={() => navigate('/local?type=files')}
                    startIcon={<Icons.Upload />}
                  >
                    Load Files
                  </Button>
                </div>
                {hasStudies ? (
                  <div className="flex grow flex-col">
                    <StudyListTable
                      tableDataSource={tableDataSource.slice(offset, offsetAndTake)}
                      numOfStudies={numOfStudies}
                      querying={querying}
                      filtersMeta={filtersMeta}
                    />
                    <div className="grow">
                      <StudyListPagination
                        onChangePage={onPageNumberChange}
                        onChangePerPage={onResultsPerPageChange}
                        currentPage={pageNumber}
                        perPage={resultsPerPage}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center pt-48">
                    {appConfig.showLoadingIndicator && isLoadingData ? (
                      <LoadingIndicatorProgress className={'h-full w-full bg-white'} />
                    ) : (
                      <EmptyStudies />
                    )}
                  </div>
                )}
              </TabsContent>

              {/* AI Assistant Tab */}
              <TabsContent value="assistant" className="flex grow flex-col p-4">
                <AIAssistant
                  session={currentSession || undefined}
                  onSessionUpdate={handleSessionUpdate}
                  onGenerateReport={(report) => {
                    setReports(prevReports => [...prevReports, report]);
                  }}
                />
              </TabsContent>

              {/* Workflow Tab */}
              <TabsContent value="workflow" className="flex grow flex-col p-4">
                <WorkflowHistory
                  workflowHistory={workflowHistory}
                  onClearHistory={clearWorkflowHistory}
                />
              </TabsContent>

              {/* Consultation Tab */}
              <TabsContent value="consultation" className="flex grow flex-col p-4">
                <DoctorList onDoctorSelect={handleDoctorSelect} onTabChange={setActiveTab} />
              </TabsContent>

              {/* Reports Tab */}
              <TabsContent value="reports" className="flex grow flex-col p-4">
                <h2 className="mb-4 text-xl font-bold">医学报告列表</h2>
                {reports.length > 0 ? (
                  <div className="space-y-4">
                    {reports.map(report => (
                      <div 
                        key={report.id} 
                        className="p-4 border rounded-lg shadow-sm cursor-pointer hover:bg-gray-50 transition-colors"
                        onClick={() => handleReportClick(report)}
                      >
                        <div className="flex justify-between items-center mb-2">
                          <h3 className="text-lg font-semibold">{report.title}</h3>
                          <span className="text-sm text-gray-500">{report.createdAt}</span>
                        </div>
                        {report.associatedImage && (
                          <p className="mb-2 text-sm text-gray-600">关联影像: {report.associatedImage}</p>
                        )}
                        <div className="space-y-1 text-sm">
                          <p><strong>诊断者:</strong> {report.content.diagnosticPerson}</p>
                          <p><strong>分析技术:</strong> {report.content.analysisTechnology}</p>
                          <p><strong>报告状态:</strong> {report.content.reportStatus}</p>
                          <p><strong>结论:</strong> {report.content.conclusion}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-64 text-gray-500">
                    暂无生成的报告
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </ScrollArea>
      </div>

      {/* Report Details Dialog */}
      <Dialog open={showReportDialog} onOpenChange={handleCloseReportDialog}>
        <DialogContent className="max-w-4xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">影像诊断报告单</DialogTitle>
            <DialogClose />
          </DialogHeader>
          
          {selectedReport && (
            <div className="space-y-6">
              {/* Medical Report Content */}
              <div className="bg-white border border-gray-300 rounded-lg p-6 shadow-sm">
                {/* Patient and Examination Information Table */}
                <table className="w-full border-collapse mb-4">
                  <tbody>
                    <tr className="border-b border-gray-300">
                      <td className="py-2 px-3 font-medium">门诊号:</td>
                      <td className="py-2 px-3">{selectedReport.content.outpatientNo}</td>
                      <td className="py-2 px-3 font-medium">影像号:</td>
                      <td className="py-2 px-3">{selectedReport.content.imageNo}</td>
                    </tr>
                    <tr className="border-b border-gray-300">
                      <td className="py-2 px-3 font-medium">姓 名:</td>
                      <td className="py-2 px-3">{selectedReport.content.patientName}</td>
                      <td className="py-2 px-3 font-medium">性 别:</td>
                      <td className="py-2 px-3">{selectedReport.content.patientGender}</td>
                      <td className="py-2 px-3 font-medium">年 龄:</td>
                      <td className="py-2 px-3">{selectedReport.content.patientAge}</td>
                      <td className="py-2 px-3 font-medium">检查设备:</td>
                      <td className="py-2 px-3">{selectedReport.content.examinationEquipment}</td>
                    </tr>
                    <tr className="border-b border-gray-300">
                      <td className="py-2 px-3 font-medium">科 别:</td>
                      <td className="py-2 px-3">{selectedReport.content.department}</td>
                      <td className="py-2 px-3 font-medium">病 区:</td>
                      <td className="py-2 px-3">{selectedReport.content.ward}</td>
                      <td className="py-2 px-3 font-medium">床 号:</td>
                      <td className="py-2 px-3">{selectedReport.content.bedNo}</td>
                      <td className="py-2 px-3 font-medium">摄片日期:</td>
                      <td className="py-2 px-3">{selectedReport.content.examinationDate} {selectedReport.content.examinationTime}</td>
                    </tr>
                  </tbody>
                </table>

                {/* Clinical Diagnosis */}
                <div className="mb-4">
                  <div className="font-medium mb-1">临床诊断:</div>
                  <div className="pl-4">{selectedReport.content.clinicalDiagnosis}</div>
                </div>

                {/* Examination Name */}
                <div className="mb-4">
                  <div className="font-medium mb-1">检查名称:</div>
                  <div className="pl-4">{selectedReport.content.examinationName}</div>
                </div>

                {/* Chief Complaint */}
                <div className="mb-4">
                  <div className="font-medium mb-1">主 诉:</div>
                  <div className="pl-4">{selectedReport.content.chiefComplaint}</div>
                </div>

                {/* Image Manifestation */}
                <div className="mb-6">
                  <div className="font-bold text-lg mb-2">影像表现:</div>
                  <div className="pl-4 whitespace-pre-line">{selectedReport.content.imageManifestation}</div>
                </div>

                {/* Image Diagnosis */}
                <div className="mb-6">
                  <div className="font-bold text-lg mb-2">影像诊断:</div>
                  <div className="pl-4 whitespace-pre-line font-medium">{selectedReport.content.imageDiagnosis}</div>
                </div>

                {/* Report Doctors */}
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <div className="font-medium">报告医师: {selectedReport.content.diagnosticPerson}</div>
                    {selectedReport.content.reviewPerson && (
                      <div className="font-medium">审核医师: {selectedReport.content.reviewPerson}</div>
                    )}
                  </div>
                  <div className="font-medium">报告日期: {selectedReport.content.reportDate} {selectedReport.content.reportTime}</div>
                </div>

                {/* Remarks */}
                {selectedReport.content.remarks && (
                  <div className="mt-4 pt-4 border-t border-gray-300">
                    <div className="font-medium mb-1">备注:</div>
                    <div className="pl-4 italic text-sm text-gray-600">{selectedReport.content.remarks}</div>
                  </div>
                )}
              </div>

              {/* Image Slices Section */}
              <div className="mt-6">
                <h4 className="text-lg font-semibold mb-4">影像切片图</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Placeholder for volume slices with lesion highlighting */}
                  {[1, 2, 3].map((slice, index) => (
                    <div key={index} className="border rounded-lg overflow-hidden shadow-sm">
                      <div className="bg-gray-200 h-48 flex items-center justify-center relative">
                        <div className="text-gray-500">
                          <Icons.VolumeRendering className="h-12 w-12 mx-auto mb-2" />
                          <p>切片图 {slice}</p>
                        </div>
                        {/* Lesion highlight overlay */}
                        <div className="absolute top-1/4 left-1/3 w-1/4 h-1/3 border-2 border-red-500 bg-red-500 bg-opacity-20 rounded-full" 
                             title="病灶区域" />
                      </div>
                      <div className="p-2 text-center text-sm text-gray-600">
                        {selectedReport.associatedImage} - 切片 {slice}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="mt-6">
            <button
              className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors"
              onClick={handleCloseReportDialog}
            >
              关闭
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

WorkList.propTypes = {
  data: PropTypes.array.isRequired,
  dataSource: PropTypes.shape({
    query: PropTypes.object.isRequired,
    getConfig: PropTypes.func,
  }).isRequired,
  isLoadingData: PropTypes.bool.isRequired,
  servicesManager: PropTypes.object.isRequired,
};

const defaultFilterValues = {
  patientName: '',
  mrn: '',
  studyDate: {
    startDate: null,
    endDate: null,
  },
  description: '',
  modalities: [],
  accession: '',
  sortBy: '',
  sortDirection: 'none',
  pageNumber: 1,
  resultsPerPage: 25,
  datasources: '',
};

function _tryParseInt(str, defaultValue) {
  let retValue = defaultValue;
  if (str && str.length > 0) {
    if (!isNaN(str)) {
      retValue = parseInt(str);
    }
  }
  return retValue;
}

function _getQueryFilterValues(params) {
  const newParams = new URLSearchParams();
  for (const [key, value] of params) {
    newParams.set(key.toLowerCase(), value);
  }
  params = newParams;

  const queryFilterValues = {
    patientName: params.get('patientname'),
    mrn: params.get('mrn'),
    studyDate: {
      startDate: params.get('startdate') || null,
      endDate: params.get('enddate') || null,
    },
    description: params.get('description'),
    modalities: params.get('modalities') ? params.get('modalities').split(',') : [],
    accession: params.get('accession'),
    sortBy: params.get('sortby'),
    sortDirection: params.get('sortdirection'),
    pageNumber: _tryParseInt(params.get('pagenumber'), undefined),
    resultsPerPage: _tryParseInt(params.get('resultsperpage'), undefined),
    datasources: params.get('datasources'),
    configUrl: params.get('configurl'),
  };

  // Delete null/undefined keys
  Object.keys(queryFilterValues).forEach(
    key => queryFilterValues[key] == null && delete queryFilterValues[key]
  );

  return queryFilterValues;
}

function _sortStringDates(s1, s2, sortModifier) {
  // TODO: Delimiters are non-standard. Should we support them?
  const s1Date = moment(s1.date, ['YYYYMMDD', 'YYYY.MM.DD'], true);
  const s2Date = moment(s2.date, ['YYYYMMDD', 'YYYY.MM.DD'], true);

  if (s1Date.isValid() && s2Date.isValid()) {
    return (s1Date.toISOString() > s2Date.toISOString() ? 1 : -1) * sortModifier;
  } else if (s1Date.isValid()) {
    return sortModifier;
  } else if (s2Date.isValid()) {
    return -1 * sortModifier;
  }
}

export default WorkList;
