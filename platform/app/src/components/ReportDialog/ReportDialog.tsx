import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@ohif/ui-next';
import { Icons } from '@ohif/ui-next';

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

interface ReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedReport: MedicalReport | null;
}

const ReportDialog: React.FC<ReportDialogProps> = ({
  open,
  onOpenChange,
  selectedReport,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} className="max-w-full h-full">
      <DialogContent className="max-w-4xl p-4 sm:p-6 max-h-[90vh] overflow-auto">
        <DialogHeader className="flex justify-between items-center">
          <DialogTitle className="text-xl font-bold">影像诊断报告单</DialogTitle>
          <DialogClose className="w-6 h-6 text-gray-600 hover:text-gray-900 focus:outline-none" />
        </DialogHeader>
        
        {selectedReport && (
          <div className="space-y-6">
            {/* Medical Report Content */}
            <div className="bg-white border border-gray-300 rounded-lg p-4 sm:p-6 shadow-sm">
              {/* Patient and Examination Information Table */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div className="flex justify-between items-center">
                  <span className="font-medium">门诊号:</span>
                  <span>{selectedReport.content.outpatientNo}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-medium">影像号:</span>
                  <span>{selectedReport.content.imageNo}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-medium">姓 名:</span>
                  <span>{selectedReport.content.patientName}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-medium">性 别:</span>
                  <span>{selectedReport.content.patientGender}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-medium">年 龄:</span>
                  <span>{selectedReport.content.patientAge}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-medium">检查设备:</span>
                  <span>{selectedReport.content.examinationEquipment}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-medium">科 别:</span>
                  <span>{selectedReport.content.department}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-medium">病 区:</span>
                  <span>{selectedReport.content.ward}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-medium">床 号:</span>
                  <span>{selectedReport.content.bedNo}</span>
                </div>
                <div className="flex justify-between items-center sm:col-span-2">
                  <span className="font-medium">摄片日期:</span>
                  <span>{selectedReport.content.examinationDate} {selectedReport.content.examinationTime}</span>
                </div>
              </div>

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
            onClick={() => onOpenChange(false)}
          >
            关闭
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ReportDialog;