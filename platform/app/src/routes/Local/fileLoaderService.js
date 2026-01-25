import dicomImageLoader from '@cornerstonejs/dicom-image-loader';

import FileLoader from './fileLoader';
import PDFFileLoader from './pdfFileLoader';
import DICOMFileLoader from './dicomFileLoader';
import NRRDFileLoader from './nrrdFileLoader';

class FileLoaderService extends FileLoader {
  fileType;
  loader;
  constructor(file) {
    super();
    const fileType = file && file.type;
    const fileName = file && file.name;
    this.loader = this.getLoader(fileType, fileName);
    this.fileType = this.loader.fileType;
  }

  addFile(file) {
    // For NRRD files, generate a custom imageId
    if (this.loader.fileType === 'nrrd') {
      // Generate a unique imageId for NRRD files
      const fileId = `nrrdfile:${Math.random().toString(36).substr(2, 9)}_${file.name}`;
      // Add the file to the file manager with the custom imageId
      dicomImageLoader.wadouri.fileManager.add(file, fileId);
      return fileId;
    }
    // For other file types (DICOM, PDF), use the default method
    return dicomImageLoader.wadouri.fileManager.add(file);
  }

  loadFile(file, imageId) {
    return this.loader.loadFile(file, imageId);
  }

  getDataset(image, imageId) {
    return this.loader.getDataset(image, imageId);
  }

  getLoader(fileType, fileName) {
    if (fileType === 'application/pdf') {
      return PDFFileLoader;
    } else if (fileName && (fileName.toLowerCase().endsWith('.nrrd') || fileName.toLowerCase().endsWith('.nhdr'))) {
      return NRRDFileLoader;
    } else {
      // Default to dicom loader
      return DICOMFileLoader;
    }
  }
}

export default FileLoaderService;
