interface GoogleCredentialResponse {
  credential: string
}

interface GoogleTokenResponse {
  access_token?: string
  error?: string
}

interface GoogleTokenClient {
  requestAccessToken: (overrides?: { prompt?: string }) => void
}

interface GooglePickerResult {
  action: string
  docs?: Array<{ id: string; name: string; mimeType: string }>
}

interface GooglePickerBuilder {
  setAppId: (id: string) => GooglePickerBuilder
  setOAuthToken: (token: string) => GooglePickerBuilder
  setDeveloperKey: (key: string) => GooglePickerBuilder
  setLocale: (locale: string) => GooglePickerBuilder
  addView: (view: object) => GooglePickerBuilder
  setCallback: (cb: (data: GooglePickerResult) => void) => GooglePickerBuilder
  build: () => { setVisible: (visible: boolean) => void }
}

interface Window {
  gapi?: {
    load: (name: string, callback: () => void) => void
  }
  google?: {
    accounts: {
      id: {
        initialize: (config: {
          client_id: string
          callback: (response: GoogleCredentialResponse) => void
        }) => void
        renderButton: (
          element: HTMLElement,
          options: Record<string, unknown>,
        ) => void
      }
      oauth2: {
        initTokenClient: (config: {
          client_id: string
          scope: string
          callback: (response: GoogleTokenResponse) => void
          error_callback?: (error: unknown) => void
        }) => GoogleTokenClient
      }
    }
    picker?: {
      PickerBuilder: new () => GooglePickerBuilder
      DocsView: new (viewId?: string) => object
      ViewId: { SPREADSHEETS: string }
      Action: { PICKED: string; CANCEL: string }
    }
  }
}