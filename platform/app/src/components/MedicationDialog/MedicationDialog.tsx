import React from 'react';
import { Dialog, DialogContent, Button } from '@ohif/ui-next';

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

interface MedicationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedMedicationList: MedicationList | null;
}

function MedicationDialog({ open, onOpenChange, selectedMedicationList }: MedicationDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      className="max-w-4xl"
    >
      <DialogContent className="max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">药单详情</h2>
          <Button
            variant="default"
            size="small"
            onClick={() => onOpenChange(false)}
          >
            关闭
          </Button>
        </div>
        {selectedMedicationList && (
          <div className="space-y-6">
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">{selectedMedicationList.title}</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p><strong>患者姓名:</strong> {selectedMedicationList.patientName}</p>
                  <p><strong>医生姓名:</strong> {selectedMedicationList.doctorName}</p>
                  <p><strong>诊断:</strong> {selectedMedicationList.diagnosis}</p>
                </div>
                <div>
                  <p><strong>创建时间:</strong> {selectedMedicationList.createdAt}</p>
                  <p><strong>药物数量:</strong> {selectedMedicationList.medications.length} 种</p>
                </div>
              </div>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold mb-3">药物详情</h3>
              <div className="space-y-4">
                {selectedMedicationList.medications.map(medication => (
                  <div key={medication.id} className="p-3 border rounded-lg">
                    <h4 className="font-semibold text-base">{medication.name}</h4>
                    <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
                      <div>
                        <p><strong>剂量:</strong> {medication.dosage}</p>
                        <p><strong>频率:</strong> {medication.frequency}</p>
                        <p><strong>疗程:</strong> {medication.duration}</p>
                        <p><strong>备注:</strong> {medication.notes}</p>
                      </div>
                      <div>
                        <p><strong>副作用:</strong></p>
                        <ul className="list-disc pl-4">
                          {medication.sideEffects.map((effect, index) => (
                            <li key={index}>{effect}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default MedicationDialog;