"use client";

import type React from "react";
import { useState, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, File, FileText, FileSpreadsheet, X } from "lucide-react";

export interface FileWithData {
  file: File;
  dataUrl: string;
}

interface FileUploadProps {
  onFileSelect?: (files: FileWithData[]) => void;
  selectedFiles?: FileWithData[];
  onRemoveFile?: (index: number) => void;
}

export function FileUpload({
  onFileSelect,
  selectedFiles = [],
  onRemoveFile,
}: FileUploadProps) {
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFiles(Array.from(e.target.files));
    }
  };

  const handleFiles = async (files: File[]) => {
    const filesWithData = await Promise.all(
      files.map(async (file) => {
        return new Promise<FileWithData>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            resolve({
              file,
              dataUrl: reader.result as string,
            });
          };
          reader.readAsDataURL(file);
        });
      }),
    );

    onFileSelect?.(filesWithData);
  };

  const removeFile = (index: number) => {
    onRemoveFile?.(index);
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split(".").pop()?.toLowerCase();
    if (ext === "pdf") return <FileText className="w-5 h-5 text-destructive" />;
    if (ext === "xlsx" || ext === "xls")
      return <FileSpreadsheet className="w-5 h-5 text-primary" />;
    if (["jpg", "jpeg", "png", "gif"].includes(ext || ""))
      return <File className="w-5 h-5 text-primary" />;
    return <File className="w-5 h-5 text-muted-foreground" />;
  };

  return (
    <div className="space-y-4">
      <Card
        className={`border-2 border-dashed transition-colors ${
          dragActive ? "border-primary bg-primary/5" : "border-border"
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <CardContent className="p-6">
          <div className="flex flex-col items-center justify-center text-center">
            <Upload className="w-10 h-10 text-muted-foreground mb-3" />
            <p className="text-base text-muted-foreground mb-1">
              Dosyaları buraya sürükleyin veya tıklayın
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              PDF, Excel, Resim dosyaları desteklenir
            </p>
            <input
              ref={inputRef}
              type="file"
              multiple
              onChange={handleChange}
              accept=".pdf,.xlsx,.xls,.jpg,.jpeg,.png"
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              size="default"
              onClick={() => inputRef.current?.click()}
              className="h-11 px-6 text-base"
            >
              Dosya Seç
            </Button>
          </div>
        </CardContent>
      </Card>

      {selectedFiles.length > 0 && (
        <div className="space-y-3">
          {selectedFiles.map((fileData, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-4 bg-secondary rounded-lg"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {getFileIcon(fileData.file.name)}
                <div className="flex-1 min-w-0">
                  <p className="text-base font-medium truncate">
                    {fileData.file.name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {(fileData.file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="default"
                onClick={() => removeFile(index)}
                className="h-10 w-10 p-0 flex-shrink-0"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
