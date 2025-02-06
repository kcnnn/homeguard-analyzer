import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface FileUploadProps {
  onFileUpload: (files: File[]) => void;
}

export const FileUpload = ({ onFileUpload }: FileUploadProps) => {
  const [hasUploadedFiles, setHasUploadedFiles] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setHasUploadedFiles(true);
      onFileUpload(acceptedFiles);
    }
  }, [onFileUpload]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': ['.jpeg', '.jpg'],
      'image/png': ['.png'],
    },
    multiple: true,
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
            <p className="text-lg text-primary">Drop your policy declarations pages here</p>
          ) : (
            <>
              <p className="text-lg">Drag and drop your policy declarations pages here</p>
              <p className="text-sm text-gray-500">or</p>
              <Button 
                variant={hasUploadedFiles ? "success" : "outline"}
              >
                Browse Files
              </Button>
            </>
          )}
          <p className="text-sm text-gray-500">Supports multiple JPEG and PNG files</p>
        </div>
      </div>
    </Card>
  );
};