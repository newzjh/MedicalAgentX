import React, { useState } from 'react';
import LocalDialog from './LocalDialog';

type LocalProps = {
  modePath: string;
};

function Local({ modePath }: LocalProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(true);

  return (
    <div className="bg-black h-screen w-screen">
      <LocalDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        modePath={modePath}
      />
    </div>
  );
}

export default Local;
