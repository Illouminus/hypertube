export interface GoogleProfile {
    id: string;
    displayName: string;
    name: {
        familyName: string;
        givenName: string;
    };
    emails: Array<{ value: string, verified?: boolean }>;
    photos: Array<{ value: string }>;
    provider: string;
    _json: any; // The raw profile data returned by Google, which may contain additional fields
    _raw: string; // The raw JSON string of the profile data
}