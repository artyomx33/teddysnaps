export { loadModels, areModelsLoaded, detectFaces, detectSingleFace, loadImage } from "./detector";
export { compareFaces, findBestMatch, findAllMatches, createFaceMatcher } from "./matcher";
export type { EnrolledChild, FaceMatch } from "./matcher";
export {
  processPhotoBatch,
  enrollChild,
  descriptorToArray,
  arrayToDescriptor,
} from "./processor";
export type { ProcessedPhoto, ProcessingProgress } from "./processor";
export { extractFaceCrop, extractAllFaceCrops } from "./cropper";
export type { FaceCrop } from "./cropper";
export { discoverFacesInBatch } from "./discovery";
export type { DiscoveredFaceData, DiscoveryProgress } from "./discovery";
