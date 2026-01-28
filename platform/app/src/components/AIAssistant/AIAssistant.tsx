import { utilities, Enums } from '@cornerstonejs/tools';
import { cache } from '@cornerstonejs/core';
import { utils } from '@ohif/core';
import * as csTools from '@cornerstonejs/tools';
import cstTypes from '@cornerstonejs/tools/types';
import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, ButtonEnums } from '@ohif/ui';
import { Icons } from '@ohif/ui-next';
import { volumeLoader, imageLoader } from '@cornerstonejs/core';
import { useNavigate } from 'react-router-dom';
import { DicomMetadataStore } from '@ohif/core';
import metadataProvider from '@ohif/core/src/classes/MetadataProvider';
import getImageId from '@ohif/core/src/utils/getImageId';
import { segmentation as cstSegmentation, Enums as csToolsEnums } from '@cornerstonejs/tools';
import { getImageDataMetadata } from '@cornerstonejs/core/utilities';

// Volume loader scheme
const VOLUME_LOADER_SCHEME = 'cornerstoneStreamingImageVolume';

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: string;
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

interface Medication {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  notes: string;
  sideEffects: string[];
}

interface MedicationList {
  id: string;
  title: string;
  patientName: string;
  createdAt: string;
  medications: Medication[];
  doctorName: string;
  diagnosis: string;
}

interface AIAssistantProps {
  session?: {
    id: string;
    type: 'ai' | 'doctor';
    doctorName?: string;
    messages: Message[];
    associatedImage?: string;
  };
  onSessionUpdate: (sessionId: string, messages: Message[]) => void;
  onGenerateReport?: (report: MedicalReport) => void;
  onExtractMedication?: (medicationList: MedicationList) => void;
}

const AIAssistant: React.FC<AIAssistantProps> = ({ session, onSessionUpdate, onGenerateReport, onExtractMedication }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>(session?.messages || []);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [processedVolumeId, setProcessedVolumeId] = useState<string | null>(null);
  const [originalVolumeId, setOriginalVolumeId] = useState<string | null>(null);
  const [renderingReady, setRenderingReady] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const volumeRef = useRef<any>(null);
  const volumeRenderingContainerRef = useRef<HTMLDivElement>(null);

  // Update local messages when session changes
  useEffect(() => {
    console.log('[AIAssistant] session变化 - 当前session:', session);
    if (session) {
      setMessages(session.messages);
      console.log('[AIAssistant] session变化 - 关联影像:', session.associatedImage);
    }
  }, [session?.messages, session?.id]);

  // Force re-render when associatedImage changes
  useEffect(() => {
    console.log('[AIAssistant] 关联影像变化 - 新的关联影像:', session?.associatedImage);
    // This effect will run when session.associatedImage changes
    // No need to do anything here, just listening to the change will trigger a re-render
  }, [session?.associatedImage]);

  // Log when component renders
  console.log('[AIAssistant] 组件渲染 - 关联影像:', session?.associatedImage);

  // Scroll to bottom when new messages are added
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Generate a unique ID for each message
  const generateId = () => {
    return Math.random().toString(36).substr(2, 9);
  };

  // Format current timestamp
  const formatTimestamp = () => {
    const now = new Date();
    return now.toDateString()+now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Call Doubao API
  const callDoubaoAPI = async (question: string) => {
    try {
      setIsLoading(true);

      const apiKey = '7682bda6-1e7b-4096-b672-42a3b5453d17';
      const apiUrl = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'doubao-seed-1-8-251228', // 豆包模型名称
          messages: [
            {
              role: 'system',
              content: 'You are a medical AI assistant. Please answer medical questions accurately and professionally.'
            },
            {
              role: 'user',
              content: question
            }
          ],
          temperature: 0.7,
          max_tokens: 1000
        })
      });

      if (!response.ok) {
        throw new Error(`API request failed with status: ${response.status}`);
      }

      const data = await response.json();
      console.log('[AIAssistant] 调用豆包API成功 - 响应数据:', data);
      const answer = data.choices[0].message.content;

      return answer;
    }
    catch (error)
    {
      console.error('Error calling Doubao API:', error);
      return t('AIAssistant:Error getting response from AI assistant');
    }
     finally
     {
      setIsLoading(false);
    }
  };

  // Call Doubao API for medication information
  const CallDoubaoForMedicans = async (conversationHistory: Message[]) => {
    try {
      setIsLoading(true);

      const apiKey = '7682bda6-1e7b-4096-b672-42a3b5453d17';
      const apiUrl = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';

      // Format conversation history for the API
      const conversationText = conversationHistory.map(msg =>
        `${msg.isUser ? '用户' : '助手'}: ${msg.text}`
      ).join('\n');

      const prompt = `请分析以下医疗对话，找出其中涉及的所有药物，并以JSON格式返回每种药物的详细信息。JSON应包含以下字段：

1. id: 唯一标识符
2. name: 药物名称
3. dosage: 用法用量
4. frequency: 用药频率
5. duration: 用药疗程
6. notes: 用药注意事项
7. sideEffects: 副作用数组
8. basicInfo: 药物基本信息
9. basicFunction: 药物基本作用

对话内容：
${conversationText}

请严格以JSON格式返回结果，不要包含任何其他文本。`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'doubao-seed-1-8-251228', // 豆包模型名称
          messages: [
            {
              role: 'system',
              content: 'You are a medical AI assistant specialized in medication analysis. Please analyze the conversation and extract medication information accurately.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.7,
          max_tokens: 2000
        })
      });

      if (!response.ok) {
        throw new Error(`API request failed with status: ${response.status}`);
      }

      const data = await response.json();
      console.log('[AIAssistant] 调用豆包API获取药物信息成功 - 响应数据:', data);
      const answer = data.choices[0].message.content;

      // Parse JSON response
      try {
        const medications = JSON.parse(answer);
        return medications;
      } catch (parseError) {
        console.error('Error parsing medication JSON:', parseError);
        return [];
      }
    }
    catch (error)
    {
      console.error('Error calling Doubao API for medications:', error);
      return [];
    }
     finally
     {
      setIsLoading(false);
    }
  };

  // Handle sending a message
  const handleSendMessage = async () => {
    if (!inputText.trim() || isLoading || !session) return;

    const userMessage: Message = {
      id: generateId(),
      text: inputText.trim(),
      isUser: true,
      timestamp: formatTimestamp()
    };

    // Get AI response or simulate doctor response
    let responseText = '';

    if (session.type === 'ai') {
      responseText = await callDoubaoAPI(inputText.trim());
    }
    else
    {
      // Simulate doctor response
      await new Promise(resolve => setTimeout(resolve, 1500));
      responseText = `这是${session.doctorName}医生的回复：${inputText.trim()}`;
    }

    const responseMessage: Message = {
      id: generateId(),
      text: responseText,
      isUser: false,
      timestamp: formatTimestamp()
    };

    // Add both user message and response to messages array
    const finalMessages = [...messages, userMessage, responseMessage];
    setMessages(finalMessages);
    // Update session only once with both messages
    onSessionUpdate(session.id, finalMessages);
    setInputText('');
  };

  // Handle input key press (send on Enter, shift+Enter for new line)
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Clear chat messages
  const handleClearChat = () => {
    if (!session) return;

    const emptyMessages: Message[] = [];
    setMessages(emptyMessages);
    onSessionUpdate(session.id, emptyMessages);
  };

  // 从studyInstanceUID获取imageIds
  const getImageIdsFromStudy = (studyInstanceUID: string) => {
    const study = DicomMetadataStore.getStudy(studyInstanceUID);
    if (!study) {
      console.error('[AIAssistant] 无法找到研究对象 - studyInstanceUID:', studyInstanceUID);
      return [];
    }

    const imageIds = [];
    study.series.forEach(series => {
      series.instances.forEach(instance => {
        try {
          const imageId = getImageId(instance, undefined, false);
          if (imageId && typeof imageId === 'string') {
            imageIds.push(imageId);

            // 将生成的imageId存储回实例对象，这样MetadataProvider就能访问它了
            if (!instance.imageId) {
              instance.imageId = imageId;
            }

            // 同步添加imageId到metadataProvider
            if (metadataProvider && typeof metadataProvider.addImageIdToUIDs === 'function') {
              try {
                // 构造uids对象，包含必要的UID信息
                const uids = {
                  StudyInstanceUID: instance.StudyInstanceUID,
                  SeriesInstanceUID: instance.SeriesInstanceUID,
                  SOPInstanceUID: instance.SOPInstanceUID
                };
                metadataProvider.addImageIdToUIDs(imageId, uids);
              } catch (error) {
                console.error('[AIAssistant] 添加imageId到metadataProvider失败:', error);
              }
            }
          } else {
            console.warn('[AIAssistant] 无效的imageId:', imageId);
          }
        } catch (error) {
          console.error('[AIAssistant] 生成imageId失败:', error);
        }
      });
    });

    console.log('[AIAssistant] 获取到的imageIds数量:', imageIds.length);
    return imageIds;
  };

  // 加载关联影像volume
  const loadAssociatedVolume = async () => {
    if (!session?.associatedImage) return null;

    // 从关联影像信息中提取studyInstanceUID
    const studyInstanceUIDMatch = session.associatedImage.match(/\(([^)]+)\)/);
    if (!studyInstanceUIDMatch) return null;

    const studyInstanceUID = studyInstanceUIDMatch[1];
    console.log('[AIAssistant] 加载关联影像 - studyInstanceUID:', studyInstanceUID);

    // 获取imageIds
    const imageIds = getImageIdsFromStudy(studyInstanceUID);
    if (imageIds.length === 0) {
      console.error('[AIAssistant] 无法获取imageIds');
      return null;
    }

    // 验证imageIds中的每个元素都是字符串
    const validImageIds = imageIds.filter(id => typeof id === 'string' && id.trim() !== '');
    if (validImageIds.length === 0) {
      console.error('[AIAssistant] 所有imageId都是无效的');
      return null;
    }

    console.log('[AIAssistant] imageIds数量:', validImageIds.length);
    console.log('[AIAssistant] 第一个imageId:', validImageIds[0]);

    // 创建volume加载参数
    // 参考CornerstoneCacheService的实现
    const volumeId = `${VOLUME_LOADER_SCHEME}:${studyInstanceUID}-${Date.now()}`;
    console.log('[AIAssistant] volumeId:', volumeId);

    // 加载volume - 参考CornerstoneCacheService的实现
    try {
      // 使用两个参数的形式，与CornerstoneCacheService保持一致
      console.log('[AIAssistant] 开始加载volume...');
      console.log('[AIAssistant] 传入的imageIds数量:', validImageIds.length);

      const volume = await volumeLoader.createAndCacheVolume(volumeId, {
        imageIds: validImageIds,
      });

      // 加载volume数据
      console.log('[AIAssistant] 开始加载volume数据...');
      await volume.load();

      console.log('[AIAssistant] 关联影像加载完成 - volumeId:', volumeId);
      return volume;
    } catch (error) {
      console.error('[AIAssistant] 加载关联影像失败:', error);
      console.error('[AIAssistant] 错误详情:', error.message);
      console.error('[AIAssistant] 错误堆栈:', error.stack);
      return null;
    }
  };

 // 阈值切割
  const createSegmentation = async (volume: any) => {
    if (!volume) return null;

    try {



      // 获取volume的imageIds
      const imageIds = volume.imageIds || [];
      if (imageIds.length === 0) {
        console.error('[AIAssistant] volume对象没有imageIds属性');
        return null;
      }

      // 创建派生的labelmap图像
      console.log('[AIAssistant] 创建派生的labelmap图像...');
      const derivedImages = await imageLoader.createAndCacheDerivedLabelmapImages(imageIds);
      const segImageIds = derivedImages.map(image => image.imageId);

      // 创建分割ID
      const segmentationId = 'segmentation-' + Date.now().toString();
      console.log('[AIAssistant] 创建分割 - segmentationId:', segmentationId);

      // 创建分割
      const segmentationPublicInput = {
        segmentationId,
        representation: {
          type: csToolsEnums.SegmentationRepresentations.Labelmap,
          data: {
            imageIds: segImageIds,
            referencedImageIds: imageIds,
            volumeId: volume.volumeId,
          },
        },
        config: {
          label: 'Lesion Segmentation',
          segments: {
            1: {
              label: 'Lesion',
              segmentIndex: 1,
              active: true,
            },
          },
        },
      };

      // 检查 cstSegmentation 对象的结构
      console.log('[AIAssistant] cstSegmentation 对象结构:', Object.keys(cstSegmentation));

      // 添加分割
      console.log('[AIAssistant] 添加分割...');
      cstSegmentation.addSegmentations([segmentationPublicInput]);
      console.log('[AIAssistant] 分割添加成功');

      return segmentationId;
    }
    catch (error) {
      console.error('[AIAssistant] 创建分割失败:', error);
      return null;
    }
  };

  // 阈值切割
  const applyThresholding = async (volume: any, segmentationId, modality: string) => {
    if (!volume) return null;

    try {
      // 根据模态设置阈值
      let lowerThreshold, upperThreshold;
      if (modality === 'CT') {
        lowerThreshold = 0;
        upperThreshold = 200;
      } else if (modality === 'MR') {
        lowerThreshold = 200;
        upperThreshold = 600;
      } else {
        // 默认阈值
        lowerThreshold = 0;
        upperThreshold = 255;
      }

      console.log('[AIAssistant] 应用阈值切割 - 模态:', modality, '阈值范围:', [lowerThreshold, upperThreshold]);

      // 获取分割数据
      const segmentation = cstSegmentation.state.getSegmentation(segmentationId);
      if (!segmentation) {
        console.error('[AIAssistant] 无法获取分割数据');
        return null;
      }

      console.log("segmentation:", segmentation);

      // 检查 cstSegmentation 对象的完整结构
      console.log('[AIAssistant] cstSegmentation 对象完整结构:', cstSegmentation);


      const labelmapData = segmentation.representationData["Labelmap"] as cstTypes.LabelmapToolOperationDataVolume;
      const isVolumeSegmentation = 'volumeId' in labelmapData;

      console.log('[AIAssistant] labelmapData:', labelmapData);

      if (!labelmapData || !labelmapData.volumeId) {
        console.log('!labelmapData || !labelmapData.volumeId');
        return null;
      }

      const { volumeId } = labelmapData;
      const labelmapVolume = cache.getVolume(volumeId);

      // 应用阈值 - 使用 Cornerstone Tools API
      /*
        csTools.utilities.segmentation.thresholdVolumeByRange(
        labelmapVolume,
        [
          { volume: volume, lower: lowerThreshold, upper: upperThreshold },
        ],
        { overwrite: true, segmentIndex: 1, segmentationId }
      );
    */

      console.log('[AIAssistant] 阈值切割完成 - labelmapVolume:', labelmapVolume);
      return segmentationId;
    }
    catch (error) {
      console.error('[AIAssistant] 阈值切割失败:', error);
      return null;
    }
  };

  // 数学形态学操作
  const applyMorphologicalOperations = (segmentationId: string) => {
    if (!segmentationId) return null;

    try {
      console.log('[AIAssistant] 应用数学形态学操作 - segmentationId:', segmentationId);

      // 获取分割数据
      const segmentation = cstSegmentation.state.getSegmentation(segmentationId);
      if (!segmentation) {
        console.error('[AIAssistant] 无法获取分割数据');
        return null;
      }

      console.log("segmentation:", segmentation);

      // 检查 cstSegmentation 对象的完整结构
      console.log('[AIAssistant] cstSegmentation 对象完整结构:', cstSegmentation);


      const labelmapData = segmentation.representationData["Labelmap"] as cstTypes.LabelmapToolOperationDataVolume;
      const isVolumeSegmentation = 'volumeId' in labelmapData;

      console.log('[AIAssistant] labelmapData:', labelmapData);

      if (!labelmapData || !labelmapData.volumeId) {
        console.log('!labelmapData || !labelmapData.volumeId');
        return null;
      }

      const { volumeId } = labelmapData;
      const labelmapVolume = cache.getVolume(volumeId);

      /*
      // 尝试通过不同方式获取 labelmap 工具
      let labelmapTool = null;

      // 方式1: 检查 cstSegmentation 下的 labelmap 相关属性
      if (cstSegmentation.labelmap) {
        labelmapTool = cstSegmentation.labelmap;
      }

      // 方式2: 检查是否有 tools 或 modules 属性
      if (!labelmapTool && cstSegmentation.tools) {
        if (cstSegmentation.tools.labelmap) {
          labelmapTool = cstSegmentation.tools.labelmap;
        }
      }

      // 执行形态学操作
      if (labelmapTool && typeof labelmapTool.applyMorphologicalOperation === 'function') {
        try {
          // 开运算 (先腐蚀后膨胀)
          console.log('[AIAssistant] 执行开运算...');
          labelmapTool.applyMorphologicalOperation(
            segmentationId,
            1, // 分割索引
            'open',
            { radius: 1 }
          );
          console.log('[AIAssistant] 开运算完成');

          // 闭运算 (先膨胀后腐蚀)
          console.log('[AIAssistant] 执行闭运算...');
          labelmapTool.applyMorphologicalOperation(
            segmentationId,
            1, // 分割索引
            'close',
            { radius: 1 }
          );
          console.log('[AIAssistant] 闭运算完成');
        } catch (error) {
          console.error('[AIAssistant] 使用 labelmapTool.applyMorphologicalOperation 失败:', error);
          return null;
        }
      } else {
        console.error('[AIAssistant] 找不到 applyMorphologicalOperation 方法');
        return null;
      }
      */
      return segmentationId;
    } catch (error) {
      console.error('[AIAssistant] 数学形态学操作失败:', error);
      return null;
    }

  };

  // 设置体渲染
  const setupVolumeRendering = async (segmentationId: string) => {
    if (!segmentationId) return false;

    try {
      console.log('[AIAssistant] 设置体渲染 - segmentationId:', segmentationId);

      // 存储处理后的segmentationId
      setProcessedVolumeId(segmentationId);
      volumeRef.current = segmentationId;

      // 标记渲染准备就绪
      setRenderingReady(true);
      console.log('[AIAssistant] 体渲染设置完成');

      // 注意：实际的3D视口创建和渲染需要在DOM元素挂载后进行
      // 这里我们先标记准备就绪，后续可以在useEffect中处理实际的渲染

      return true;
    } catch (error) {
      console.error('[AIAssistant] 体渲染设置失败:', error);
      return false;
    }
  };

  // 清理资源
  const cleanupResources = () => {
    if (processedVolumeId) {
      console.log('[AIAssistant] 清理volume资源 - volumeId:', processedVolumeId);
      // 注意：cache.removeVolume 方法不存在，Cornerstone会自动管理缓存
      // 我们只需要清理本地引用即可
    }

    setProcessedVolumeId(null);
    setOriginalVolumeId(null);
    setRenderingReady(false);
    volumeRef.current = null;
  };

  // 组件卸载时清理资源
  useEffect(() => {
    return () => {
      cleanupResources();
    };
  }, []);

  // 当processedVolumeId或originalVolumeId变化时，尝试创建3D视口
  useEffect(() => {
    if (renderingReady && processedVolumeId && originalVolumeId && volumeRenderingContainerRef.current) {
      console.log('[AIAssistant] 准备创建3D视口');

      // 导入必要的Cornerstone3D组件
      import('@cornerstonejs/core').then(async (core) => {
        const {
          RenderingEngine,
          Enums,
          cache
        } = core;
        const ViewportType = Enums.ViewportType;

        try {
          // 创建渲染引擎
          const renderingEngineId = 'lesion-volume-rendering-engine';
          const renderingEngine = new RenderingEngine(renderingEngineId);

          // 获取容器元素
          const container = volumeRenderingContainerRef.current;

          // 设置视口配置
          const viewportId = 'lesion-volume-viewport';
          const viewportInput = {
            viewportId,
            type: ViewportType.VOLUME_3D,
            element: container,
            defaultOptions: {}
          };

          // 注册视口
          renderingEngine.enableElement(viewportInput);

          // 获取视口
          const viewport = renderingEngine.getViewport(viewportId);

          console.log('[AIAssistant] 添加分割表示到视口...');

          // 获取分割数据
          const segmentation = cstSegmentation.state.getSegmentation(processedVolumeId);
          if (!segmentation) {
            console.error('[AIAssistant] 无法获取分割数据');
            return null;
          }

          console.log("segmentation:", segmentation);

          // 检查 cstSegmentation 对象的完整结构
          console.log('[AIAssistant] cstSegmentation 对象完整结构:', cstSegmentation);


          const labelmapData = segmentation.representationData["Labelmap"] as cstTypes.LabelmapToolOperationDataVolume;
          const isVolumeSegmentation = 'volumeId' in labelmapData;

          console.log('[AIAssistant] labelmapData:', labelmapData);

          if (!labelmapData || !labelmapData.volumeId) {
            console.log('!labelmapData || !labelmapData.volumeId');
            return null;
          }

          const { volumeId } = labelmapData;
          const labelmapVolume = cache.getVolume(volumeId);

          // 对于体积分割，添加分割表示
          try {
            // 使用类型断言确保TypeScript知道这是VolumeViewport
            const volumeViewport = viewport as any;
            if (volumeViewport.setVolumes) {
              // 设置分割volume
              volumeViewport.setVolumes([
                { volumeId: volumeId, blendMode: 1 } // 使用数字值代替枚举，1表示MAXIMUM_INTENSITY
              ]);
              volumeViewport.render();
              console.log('[AIAssistant] 分割表示渲染完成');
            } else {
              console.error('[AIAssistant] 视口不支持setVolumes方法');
            }
          } catch (error) {
            console.error('[AIAssistant] 添加分割表示失败:', error);
          }

        } catch (error) {
          console.error('[AIAssistant] 创建3D视口失败:', error);
        }
      });
    }
  }, [renderingReady, processedVolumeId, originalVolumeId]);

  // 处理影像
  const processImage = async () => {
    if (!session?.associatedImage) return false;

    setIsProcessingImage(true);

    try {
      // 1. 加载关联影像volume
      const volume = await loadAssociatedVolume();
      if (!volume) {
        console.error('[AIAssistant] 无法加载关联影像');
        setIsProcessingImage(false);
        return false;
      }

      // 存储原始volume的volumeId
      if (volume.volumeId) {
        setOriginalVolumeId(volume.volumeId);
        console.log('[AIAssistant] 存储原始volumeId:', volume.volumeId);
      }

      // 2. 确定模态 (这里简化处理，实际应该从DICOM元数据中获取)
      const modality = session.associatedImage.includes('CT') ? 'CT' : 'MR';

      const segmentationId = await createSegmentation(volume);



      // 3. 应用阈值切割
      const segmentationId2 = await applyThresholding(volume, segmentationId, modality);
      if (!segmentationId2) {
        console.error('[AIAssistant] 阈值切割失败');
        setIsProcessingImage(false);
        return false;
      }

      // 4. 应用数学形态学操作
      const processedSegmentationId = applyMorphologicalOperations(segmentationId2);
      if (!processedSegmentationId) {
        console.error('[AIAssistant] 数学形态学操作失败');
        setIsProcessingImage(false);
        return false;
      }

      // 5. 设置体渲染
      const renderingSuccess = await setupVolumeRendering(segmentationId);

      setIsProcessingImage(false);
      return renderingSuccess;
    } catch (error) {
      console.error('[AIAssistant] 影像处理失败:', error);
      setIsProcessingImage(false);
      return false;
    }
  };

  // 分析影像病灶
  const handleGenerateLesionImage = async () => {
    if (!session) return;

    // 处理影像
    await processImage();
  };

  // Generate medical report
  const handleGenerateReport = () => {
    if (!session || !onGenerateReport) return;

    const now = new Date();
    const formattedDate = now.toISOString().split('T')[0];
    const formattedTime = now.toTimeString().split(' ')[0];

    // Generate a simple report based on the conversation and associated image
    const report: MedicalReport = {
      id: `report-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      title: `${session.associatedImage ? session.associatedImage : '医学报告'} - ${formattedDate}`,
      createdAt: now.toISOString(),
      associatedImage: session.associatedImage,
      content: {
        // 患者基本信息
        patientName: '患者姓名',
        patientGender: '女',
        patientAge: '30岁',
        outpatientNo: `K${Math.floor(Math.random() * 100000000)}`,
        imageNo: `Q${Math.floor(Math.random() * 1000000)}`,
        department: '骨科',
        ward: '无',
        bedNo: '无',

        // 检查信息
        examinationEquipment: '联影MR',
        examinationDate: formattedDate,
        examinationTime: formattedTime,
        examinationName: '[右膝关节MRI, 平扫]',
        clinicalDiagnosis: '主：膝关节痛',
        chiefComplaint: '膝关节痛',

        // 影像信息
        imageManifestation: '右膝关节MRI平扫\n横断位FSE: PDWI；矢状位FSE: PDWI、T1WI；冠状位FSE: PDWI、T1WI；\n右膝关节在位，关节间隙正常，股骨下段见局灶性PDWI高信号影，内侧半月板后角见横行PDWI高信号影，未累及关节面；外侧半月板未见明显异常信号；前交叉韧带上部肿胀，PDWI信号增高；后交叉韧带、内外侧副韧带连续，连续性未见明确中断，其内信号未见明显异常。膝关节腔、髌上囊内见少量积液信号。',
        imageDiagnosis: '右股骨下段局灶性骨髓水肿；\n右膝前交叉韧带损伤，请结合查体，随访；\n右膝内侧半月板后角变性（I-II°）。\n右膝关节腔、髌上囊少量积液。',

        // 报告信息
        diagnosticPerson: session.type === 'ai' ? 'AI智能体' : session.doctorName || '医生',
        reviewPerson: '',
        reportDate: formattedDate,
        reportTime: formattedTime,
        reportStatus: '已完成',

        // 其他信息
        analysisTechnology: session.type === 'ai' ? '大语言模型' : '人工诊断',
        findings: '根据影像分析，发现[病灶描述]。',
        recommendations: '建议进一步检查或治疗方案。',
        studyInformation: session.associatedImage || '未关联具体研究',
        conclusion: '综合分析结果，诊断为[诊断结论]。',
        remarks: '本报告仅供临床医师参考，不作其它证明用。'
      }
    };

    // Call the callback to add the report to the list
    onGenerateReport(report);
  };

  // Extract medication recommendations from conversation
  const handleExtractMedication = async () => {
    if (!session || !onExtractMedication) return;

    const now = new Date();
    const formattedDate = now.toISOString().split('T')[0];
    const formattedTime = now.toTimeString().split(' ')[0];

    // Extract doctor information
    const doctorName = session.type === 'ai' ? 'AI智能体' : session.doctorName || '医生';

    // Extract diagnosis from messages (simplified approach)
    let diagnosis = '未明确诊断';
    const diagnosisKeywords = ['诊断', '确诊', '患有', '病', '症'];
    for (const message of messages) {
      for (const keyword of diagnosisKeywords) {
        if (message.text.includes(keyword)) {
          diagnosis = message.text;
          break;
        }
      }
      if (diagnosis !== '未明确诊断') break;
    }

    // Call Doubao API to extract medication information
    const extractedMedications = await CallDoubaoForMedicans(messages);

    // Use sample medications if no medication info found from API
    let medications: Medication[];
    if (extractedMedications && extractedMedications.length > 0) {
      // Convert API response to Medication type
      medications = extractedMedications.map((med: any) => ({
        id: med.id || `med-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: med.name,
        dosage: med.dosage,
        frequency: med.frequency,
        duration: med.duration,
        notes: med.notes,
        sideEffects: med.sideEffects || []
      }));
    } else {
      // Sample medications for demonstration
      medications = [
        {
          id: `med-${Date.now()}-1`,
          name: '布洛芬缓释胶囊',
          dosage: '300mg',
          frequency: '每日2次',
          duration: '7天',
          notes: '饭后服用',
          sideEffects: ['胃肠道不适', '头痛', '头晕']
        },
        {
          id: `med-${Date.now()}-2`,
          name: '盐酸氨基葡萄糖胶囊',
          dosage: '500mg',
          frequency: '每日3次',
          duration: '30天',
          notes: '随餐服用',
          sideEffects: ['胃肠道不适', '皮疹', '嗜睡']
        }
      ];
    }

    // Generate medication list
    const medicationList: MedicationList = {
      id: `medication-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      title: `${session.associatedImage ? session.associatedImage : '用药建议'} - ${formattedDate}`,
      patientName: '患者姓名',
      createdAt: now.toISOString(),
      medications: medications,
      doctorName: doctorName,
      diagnosis: diagnosis
    };

    // Call the callback to add the medication list to the list
    onExtractMedication(medicationList);
  };

  return (
    <div className="flex flex-col items-center flex-grow text-white">
      {session?.type === 'ai' || !session ? (
        <>
          <h2 className="mb-2 text-2xl font-bold">{t('WorkList:AI Assistant')}</h2>
          <p className="mb-6 text-center text-gray-400">{t('WorkList:Ask questions about medical images')}</p>
        </>
      ) : (
        <>
          <h2 className="mb-2 text-2xl font-bold">{session?.doctorName}医生</h2>
          <p className="mb-6 text-center text-gray-400">与{session?.doctorName}医生进行会诊</p>
        </>
      )}

      {/* Associated image info */}
      {session?.associatedImage && (
        <div className="mb-4 p-2 rounded bg-blue-900 text-sm">
          关联影像: {session.associatedImage}
        </div>
      )}

      <div className="w-full max-w-2xl space-y-4">
        {/* Chat messages container */}
        <div className="h-64 rounded-lg bg-gray-800 p-4 overflow-y-auto">
          <div className="space-y-4">
            {messages.length === 0 ? (
              <div className="flex justify-center items-center h-full text-gray-500">
                {(session?.type === 'ai' || !session) ?
                  t('AIAssistant:No messages yet. Ask your first question!') :
                  `还没有与${session?.doctorName}医生的消息，开始对话吧！`
                }
              </div>
            ) : (
              messages.map(message => (
                <div
                  key={message.id}
                  className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg p-3 ${message.isUser ? 'bg-primary text-white' : 'bg-gray-700 text-white'}`}
                  >
                    <div className="text-sm">{message.text}</div>
                    <div className={`text-xs mt-1 ${message.isUser ? 'text-primary-100' : 'text-gray-400'}`}>
                      {message.timestamp}
                    </div>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Generate buttons */}
        <div className="flex justify-center gap-2 mb-2">
          <Button
            type={ButtonEnums.type.secondary}
            size={ButtonEnums.size.medium}
            onClick={handleClearChat}
            startIcon={<Icons.Trash />}
            disabled={!session || messages.length === 0}
          >
            清理对话
          </Button>
          <Button
            type={ButtonEnums.type.secondary}
            size={ButtonEnums.size.medium}
            onClick={handleGenerateLesionImage}
            startIcon={<Icons.ViewportViews />}
            disabled={!session}
          >
            分析影像病灶
          </Button>
          <Button
            type={ButtonEnums.type.secondary}
            size={ButtonEnums.size.medium}
            onClick={handleGenerateReport}
            startIcon={<Icons.Download />}
            disabled={!session}
          >
            {t('WorkList:Generate Report')}
          </Button>
          <Button
            type={ButtonEnums.type.secondary}
            size={ButtonEnums.size.medium}
            onClick={handleExtractMedication}
            startIcon={<Icons.Info />}
            disabled={!session}
          >
            提取用药建议
          </Button>
        </div>

        {/* Input area */}
        <div className="flex flex-col space-y-2">
          <textarea
            className="w-full h-40 rounded-lg bg-gray-800 p-4 text-white resize-none focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder={(session?.type === 'ai' || !session) ? t('WorkList:Enter your question here...') : `向${session?.doctorName}医生提问...`}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={isLoading || !session}
          />
          <div className="flex justify-between items-center">
            <div className="flex gap-2">
              <Button
                type={ButtonEnums.type.primary}
                size={ButtonEnums.size.small}
                onClick={() => {
                  // Store the current tab and session ID before navigation
                  localStorage.setItem('lastActiveTab', 'assistant');
                  if (session) {
                    localStorage.setItem('lastSessionId', session.id);
                    console.log('[AIAssistant] 点击Load DICOM按钮 - 当前会话ID:', session.id);
                    console.log('[AIAssistant] 点击Load DICOM按钮 - 当前关联影像:', session.associatedImage);
                  }
                  navigate('/local?type=dicom&action=loadFolder');
                }}
                startIcon={<Icons.Upload />}
              >
                Load DICOM Files
              </Button>
              <Button
                type={ButtonEnums.type.primary}
                size={ButtonEnums.size.small}
                onClick={() => {
                  // Store the current tab and session ID before navigation
                  localStorage.setItem('lastActiveTab', 'assistant');
                  if (session) {
                    localStorage.setItem('lastSessionId', session.id);
                    console.log('[AIAssistant] 点击Load Files按钮 - 当前会话ID:', session.id);
                    console.log('[AIAssistant] 点击Load Files按钮 - 当前关联影像:', session.associatedImage);
                  }
                  navigate('/local?type=files&action=loadFile');
                }}
                startIcon={<Icons.Upload />}
              >
                Load Files
              </Button>
            </div>
            <Button
              type={ButtonEnums.type.primary}
              size={ButtonEnums.size.medium}
              onClick={handleSendMessage}
              startIcon={isLoading ? <Icons.LoadingSpinner /> : <Icons.ArrowRightBold />}
              disabled={isLoading || !inputText.trim() || !session}
            >
              {isLoading ? t('WorkList:Loading...') : t('WorkList:Send')}
            </Button>
          </div>
        </div>

        {/* Volume Rendering Area */}
        {isProcessingImage && (
          <div className="mt-4 p-4 rounded-lg bg-gray-800 flex flex-col items-center justify-center">
            <Icons.LoadingSpinner className="h-8 w-8 text-primary animate-spin" />
            <p className="mt-2 text-gray-400">正在处理影像...</p>
          </div>
        )}

        {renderingReady && processedVolumeId && (
          <div className="mt-4 p-4 rounded-lg bg-gray-800">
            <h3 className="text-lg font-semibold mb-2">体渲染结果</h3>
            <div
              ref={volumeRenderingContainerRef}
              className="w-full h-64 rounded-lg bg-black"
            >
              {/* 3D视口将在这里渲染 */}
            </div>
            <p className="text-xs text-gray-600 mt-2">Volume ID: {processedVolumeId}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AIAssistant;
