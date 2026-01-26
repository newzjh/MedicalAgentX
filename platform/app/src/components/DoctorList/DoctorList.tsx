import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, ButtonEnums } from '@ohif/ui';
import { Icons, ScrollArea } from '@ohif/ui-next';

interface Doctor {
  id: string;
  name: string;
  hospital: string;
  department: string;
  description: string;
}

interface DoctorListProps {
  onDoctorSelect: (doctor: Doctor) => void;
}

const DoctorList: React.FC<DoctorListProps> = ({ onDoctorSelect }) => {
  const { t } = useTranslation();
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);

  // 模拟医生数据
  const doctors: Doctor[] = [
    {
      id: '1',
      name: '张医生',
      hospital: '北京协和医院',
      department: '放射科',
      description: '从事放射诊断工作20年，擅长胸部、腹部疾病的影像诊断。'
    },
    {
      id: '2',
      name: '李医生',
      hospital: '上海瑞金医院',
      department: '神经内科',
      description: '专注于脑血管疾病的影像诊断和介入治疗，具有丰富的临床经验。'
    },
    {
      id: '3',
      name: '王医生',
      hospital: '广州中山医院',
      department: '骨科',
      description: '擅长骨关节疾病的影像诊断，尤其是MRI诊断方面有深入研究。'
    },
    {
      id: '4',
      name: '赵医生',
      hospital: '成都华西医院',
      department: '心血管内科',
      description: '从事心血管影像诊断工作15年，擅长冠心病、心肌病的影像评估。'
    },
    {
      id: '5',
      name: '刘医生',
      hospital: '武汉同济医院',
      department: '肿瘤科',
      description: '专注于肿瘤的影像诊断和疗效评估，尤其是PET-CT诊断方面有丰富经验。'
    }
  ];

  const handleDoctorSelect = (doctor: Doctor) => {
    setSelectedDoctor(doctor);
    onDoctorSelect(doctor);
  };

  const handleInvite = () => {
    if (selectedDoctor) {
      // 这里可以添加邀请逻辑
      console.log('邀请医生:', selectedDoctor.name);
      // 可以添加通知或其他反馈
    }
  };

  return (
    <div className="flex flex-col h-full text-white">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-2xl font-bold">{t('WorkList:Doctor List')}</h2>
        <Button
          type={ButtonEnums.type.primary}
          size={ButtonEnums.size.small}
          onClick={handleInvite}
          disabled={!selectedDoctor}
          startIcon={<Icons.ArrowRightBold />}
        >
          {t('WorkList:Invite to Consultation')}
        </Button>
      </div>

      <ScrollArea className="flex-grow">
        <div className="space-y-3">
          {doctors.map(doctor => (
            <div
              key={doctor.id}
              className={`rounded-lg p-4 transition-all duration-200 cursor-pointer ${selectedDoctor?.id === doctor.id ? 'bg-blue-900 border-2 border-blue-500' : 'bg-gray-800 hover:bg-gray-700'}`}
              onClick={() => handleDoctorSelect(doctor)}
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="text-lg font-semibold">{doctor.name}</h3>
                  <p className="text-sm text-gray-400">{doctor.hospital} - {doctor.department}</p>
                </div>
                {selectedDoctor?.id === doctor.id && (
                  <Icons.Checked className="h-5 w-5 text-blue-500" />
                )}
              </div>
              <p className="text-sm text-gray-300">{doctor.description}</p>
            </div>
          ))}
        </div>
      </ScrollArea>

      {selectedDoctor && (
        <div className="mt-4 p-4 bg-gray-800 rounded-lg">
          <h3 className="text-lg font-semibold mb-2">{t('WorkList:Selected Doctor')}</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-400">{t('WorkList:Name')}</p>
              <p className="text-white">{selectedDoctor.name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-400">{t('WorkList:Hospital')}</p>
              <p className="text-white">{selectedDoctor.hospital}</p>
            </div>
            <div>
              <p className="text-sm text-gray-400">{t('WorkList:Department')}</p>
              <p className="text-white">{selectedDoctor.department}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DoctorList;
