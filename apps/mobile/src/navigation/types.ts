export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
};

export type AuthStackParamList = {
  SignIn: undefined;
  SignUp: undefined;
  AuthCallback: { url?: string };
};

export type MainTabParamList = {
  Dashboard: undefined;
  Partners: undefined;
  Profile: undefined;
};

import { PhotoUploadAnalysis } from '@dating-app/shared';

export type PartnersStackParamList = {
  PartnersList: undefined;
  PartnerDetail: { partnerId: string; uploadPhoto?: boolean; uploadData?: any; faceDescriptor?: number[]; imageUri?: string; source?: 'Dashboard' | 'PartnersList' };
  PartnerEdit: { partnerId: string };
  PartnerCreate: { uploadPhoto?: boolean; uploadData?: any; faceDescriptor?: number[]; imageUri?: string };
  SimilarPartners: {
    currentPartnerId: string; // Empty string when uploading from dashboard
    analysisData: PhotoUploadAnalysis;
    uploadData: {
      optimizedUri: string;
      width: number;
      height: number;
      mimeType: string;
      fileName: string;
    };
    faceDescriptor: number[] | null;
    imageUri: string; // Original image URI for preview
  };
  PhotoUpload: { partnerId?: string; source?: 'Dashboard' | 'PartnersList' };
};

export type UploadStackParamList = {
  UploadPhoto: { partnerId: string };
  SimilarPhotos: { partnerId: string; photoId: string };
};



