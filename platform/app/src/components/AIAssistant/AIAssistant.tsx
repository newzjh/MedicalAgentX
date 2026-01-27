import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, ButtonEnums } from '@ohif/ui';
import { Icons } from '@ohif/ui-next';
import { volumeLoader, cache, segmentation, Enums } from '@cornerstonejs/core';
import * as cstSegmentation from '@cornerstonejs/tools';
import { LABELMAP } from '@cornerstonejs/tools';
import { cornerstoneViewportService, DicomMetadataStore } from '@ohif/core';
import getImageId from '@ohif/core/src/utils/getImageId';

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
}

const AIAssistant: React.FC<AIAssistantProps> = ({ session, onSessionUpdate, onGenerateReport }) => {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<Message[]>(session?.messages || []);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [processedVolumeId, setProcessedVolumeId] = useState<string | null>(null);
  const [renderingReady, setRenderingReady] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const volumeRef = useRef<any>(null);

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
    return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Call Doubao API
  const callDoubaoAPI = async (question: string) => {
    try {
      setIsLoading(true);

      // TODO: Replace with actual Doubao API call
      // For now, we'll simulate a response
      await new Promise(resolve => setTimeout(resolve, 1500));

      const response = {
        answer: `This is a simulated response to your question: "${question}". In a real implementation, this would be replaced with an actual response from the Doubao API.`
      };

      return response.answer;
    } catch (error) {
      console.error('Error calling Doubao API:', error);
      return t('AIAssistant:Error getting response from AI assistant');
    } finally {
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

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    onSessionUpdate(session.id, updatedMessages);
    setInputText('');

    // Get AI response or simulate doctor response
    let responseText = '';
    if (session.type === 'ai') {
      responseText = await callDoubaoAPI(inputText.trim());
    } else {
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

    const finalMessages = [...updatedMessages, responseMessage];
    setMessages(finalMessages);
    onSessionUpdate(session.id, finalMessages);
  };

  // Handle input key press (send on Enter, shift+Enter for new line)
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
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
        const imageId = getImageId(instance);
        if (imageId) {
          imageIds.push(imageId);
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

    console.log('[AIAssistant] imageIds数量:', imageIds.length);

    // 创建volume加载参数
    // 参考CornerstoneCacheService的实现
    const volumeId = `${VOLUME_LOADER_SCHEME}:${studyInstanceUID}-${Date.now()}`;
    console.log('[AIAssistant] volumeId:', volumeId);

    // 加载volume - 参考CornerstoneCacheService的实现
    try {
      // 使用两个参数的形式，与CornerstoneCacheService保持一致
      const volume = await volumeLoader.createAndCacheVolume(volumeId, {
        imageIds: imageIds,
      });

      // 加载volume数据
      await volume.load();

      console.log('[AIAssistant] 关联影像加载完成 - volumeId:', volumeId);
      return volume;
    } catch (error) {
      console.error('[AIAssistant] 加载关联影像失败:', error);
      return null;
    }
  };

  // 阈值切割
  const applyThresholding = (volume: any, modality: string) => {
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

      // 创建labelmap volume
      const labelmapVolumeId = 'labelmap-' + Date.now().toString();
      console.log('[AIAssistant] labelmapVolumeId类型:', typeof labelmapVolumeId, '值:', labelmapVolumeId);

      // 检查volume是否有createLabelmapVolume方法
      if (typeof volume.createLabelmapVolume !== 'function') {
        console.error('[AIAssistant] volume对象没有createLabelmapVolume方法');
        return null;
      }

      const labelmapVolume = volume.createLabelmapVolume(labelmapVolumeId);

      // 检查labelmapVolume是否有applyThreshold方法
      if (typeof labelmapVolume.applyThreshold !== 'function') {
        console.error('[AIAssistant] labelmapVolume对象没有applyThreshold方法');
        return null;
      }

      // 应用阈值
      labelmapVolume.applyThreshold(lowerThreshold, upperThreshold);

      console.log('[AIAssistant] 阈值切割完成 - labelmapVolumeId:', labelmapVolumeId);
      return labelmapVolume;
    } catch (error) {
      console.error('[AIAssistant] 阈值切割失败:', error);
      return null;
    }
  };

  // 数学形态学操作
  const applyMorphologicalOperations = (labelmapVolume: any) => {
    if (!labelmapVolume) return null;

    try {
      console.log('[AIAssistant] 应用数学形态学操作');

      // 开运算 (先腐蚀后膨胀)
      labelmapVolume.applyMorphologicalOperation('open', { radius: 1 });
      console.log('[AIAssistant] 开运算完成');

      // 闭运算 (先膨胀后腐蚀)
      labelmapVolume.applyMorphologicalOperation('close', { radius: 1 });
      console.log('[AIAssistant] 闭运算完成');

      return labelmapVolume;
    } catch (error) {
      console.error('[AIAssistant] 数学形态学操作失败:', error);
      return null;
    }
  };

  // 设置体渲染
  const setupVolumeRendering = async (processedVolume: any) => {
    if (!processedVolume) return false;

    try {
      console.log('[AIAssistant] 设置体渲染');

      // 存储处理后的volumeId
      setProcessedVolumeId(processedVolume.volumeId);
      volumeRef.current = processedVolume;

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
      try {
        cache.removeVolume(processedVolumeId);
        console.log('[AIAssistant] 清理volume资源 - volumeId:', processedVolumeId);
      } catch (error) {
        console.error('[AIAssistant] 清理volume资源失败:', error);
      }
    }

    setProcessedVolumeId(null);
    setRenderingReady(false);
    volumeRef.current = null;
  };

  // 组件卸载时清理资源
  useEffect(() => {
    return () => {
      cleanupResources();
    };
  }, []);

  // 当processedVolumeId变化时，尝试创建3D视口
  useEffect(() => {
    if (renderingReady && processedVolumeId) {
      console.log('[AIAssistant] 准备创建3D视口');
      // 这里可以添加创建3D视口的逻辑
      // 由于需要DOM元素挂载，实际实现可能需要使用useRef和useEffect
    }
  }, [renderingReady, processedVolumeId]);

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

      // 2. 确定模态 (这里简化处理，实际应该从DICOM元数据中获取)
      const modality = session.associatedImage.includes('CT') ? 'CT' : 'MR';

      // 3. 应用阈值切割
      const thresholdedVolume = applyThresholding(volume, modality);
      if (!thresholdedVolume) {
        console.error('[AIAssistant] 阈值切割失败');
        setIsProcessingImage(false);
        return false;
      }

      // 4. 应用数学形态学操作
      const processedVolume = applyMorphologicalOperations(thresholdedVolume);
      if (!processedVolume) {
        console.error('[AIAssistant] 数学形态学操作失败');
        setIsProcessingImage(false);
        return false;
      }

      // 5. 设置体渲染
      const renderingSuccess = setupVolumeRendering(processedVolume);

      setIsProcessingImage(false);
      return renderingSuccess;
    } catch (error) {
      console.error('[AIAssistant] 影像处理失败:', error);
      setIsProcessingImage(false);
      return false;
    }
  };

  // 生成病灶影像
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

  return (
    <div className="flex flex-col items-center flex-grow text-white">
      {session?.type === 'ai' ? (
        <>
          <Icons.Info className="mb-4 h-16 w-16 text-primary" />
          <h2 className="mb-2 text-2xl font-bold">{t('WorkList:AI Assistant')}</h2>
          <p className="mb-6 text-center text-gray-400">{t('WorkList:Ask questions about medical images')}</p>
        </>
      ) : (
        <>
          <Icons.Patient className="mb-4 h-16 w-16 text-primary" />
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
                {session?.type === 'ai' ?
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
            onClick={handleGenerateLesionImage}
            startIcon={<Icons.ViewportViews />}
            disabled={!session}
          >
            生成病灶影像
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
        </div>

        {/* Input area */}
        <div className="flex flex-col space-y-2">
          <textarea
            className="w-full h-40 rounded-lg bg-gray-800 p-4 text-white resize-none focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder={session?.type === 'ai' ? t('WorkList:Enter your question here...') : `向${session?.doctorName}医生提问...`}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={isLoading}
          />
          <div className="flex justify-end">
            <Button
              type={ButtonEnums.type.primary}
              size={ButtonEnums.size.medium}
              onClick={handleSendMessage}
              startIcon={isLoading ? <Icons.LoadingSpinner /> : <Icons.ArrowRightBold />}
              disabled={isLoading || !inputText.trim()}
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
            <div className="w-full h-64 rounded-lg bg-black flex items-center justify-center">
              {/* 这里将显示体渲染结果 */}
              <div id="volume-rendering-container" className="w-full h-full"></div>
              <p className="text-gray-500">体渲染已准备就绪</p>
              <p className="text-xs text-gray-600 mt-2">Volume ID: {processedVolumeId}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AIAssistant;
