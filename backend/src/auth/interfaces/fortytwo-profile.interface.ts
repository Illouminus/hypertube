export interface FortyTwoProfile {
id: string;
  username: string;
  displayName: string;
  name: {
    familyName: string;
    givenName: string;
  };
  emails: Array<{ value: string }>;
  photos: Array<{ value: string }>;
  _raw: string;
  _json: any;
}