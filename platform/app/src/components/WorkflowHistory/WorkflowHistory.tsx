import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, ButtonEnums } from '@ohif/ui';
import { Icons } from '@ohif/ui-next';

interface WorkflowItem {
  id: string;
  title: string;
  description: string;
  iconName: keyof typeof Icons;
  timestamp: string;
}

interface WorkflowHistoryProps {
  workflowHistory: WorkflowItem[];
  onClearHistory: () => void;
}

const WorkflowHistory: React.FC<WorkflowHistoryProps> = ({ workflowHistory, onClearHistory }) => {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col h-full text-gray-900">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-2xl font-bold">{t('WorkList:Workflow History')}</h2>
        <Button
          type={ButtonEnums.type.secondary}
          size={ButtonEnums.size.small}
          onClick={onClearHistory}
          startIcon={<Icons.Trash />}
          disabled={workflowHistory.length === 0}
        >
          {t('WorkList:Clear History')}
        </Button>
      </div>
      {workflowHistory.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-grow text-gray-400">
          <Icons.StatusTracking className="mb-4 h-16 w-16 text-gray-400" />
          <p>{t('WorkList:No workflow history yet')}</p>
        </div>
      ) : (
        <div className="h-full overflow-y-auto">
          <div className="space-y-3">
            {workflowHistory.map((item, index) => {
              const IconComponent = item.iconName && Icons[item.iconName] ? Icons[item.iconName] : null;
              return (
                <div key={index} className="rounded-lg bg-gray-100 p-4 hover:bg-gray-200 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center">
                      {IconComponent && <IconComponent className="mr-2 h-4 w-4 text-primary" />}
                      <span className="font-medium">{item.title}</span>
                    </div>
                    <span className="text-xs text-gray-500">{item.timestamp}</span>
                  </div>
                  <p className="text-sm text-gray-600">{item.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkflowHistory;
