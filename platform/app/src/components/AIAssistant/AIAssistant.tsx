import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, ButtonEnums } from '@ohif/ui';
import { Icons } from '@ohif/ui-next';

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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Update local messages when session changes
  useEffect(() => {
    if (session) {
      setMessages(session.messages);
    }
  }, [session]);

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

        {/* Generate report button */}
        <div className="flex justify-center mb-2">
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
      </div>
    </div>
  );
};

export default AIAssistant;
