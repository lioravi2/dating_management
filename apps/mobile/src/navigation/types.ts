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

export type PartnersStackParamList = {
  PartnersList: undefined;
  PartnerDetail: { partnerId: string };
  PartnerEdit: { partnerId: string };
  PartnerCreate: undefined;
};

export type UploadStackParamList = {
  UploadPhoto: { partnerId: string };
  SimilarPhotos: { partnerId: string; photoId: string };
};



