import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface FileUploadProps {
  onFileUpload: (file: File) => void;
}

export const FileUpload = ({ onFileUpload }: FileUploadProps) => {
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      onFileUpload(acceptedFiles[0]);
    }
  }, [onFileUpload]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': ['.jpeg', '.jpg'],
      'image/png': ['.png'],
    },
    maxFiles: 1,
  });

  return (
    <Card className="w-full p-6">
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
          ${isDragActive ? 'border-primary bg-primary/5' : 'border-gray-300 hover:border-primary'}`}
      >
        <input {...getInputProps()} />
        <div className="space-y-4">
          <div className="text-4xl text-gray-400">📄</div>
          {isDragActive ? (
            <p className="text-lg text-primary">Drop your policy declarations page here</p>
          ) : (
            <>
              <p className="text-lg">Drag and drop your policy declarations page here</p>
              <p className="text-sm text-gray-500">or</p>
              <Button variant="outline">Browse Files</Button>
            </>
          )}
          <p className="text-sm text-gray-500">Supports JPEG and PNG files only</p>
        </div>
      </div>
    </Card>
  );
};