/* eslint-disable @typescript-eslint/no-explicit-any -- Google gapi/picker have no bundled types */
declare global {
    interface Window { gapi?: any; google?: any }
}

const loadScript = (src: string) => new Promise<void>((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Falha ao carregar ${src}`));
    document.body.appendChild(script);
});

export interface PickedFolder {
    folderId: string;
    sharedDriveId: string | null;
}

export const pickDriveFolder = async (accessToken: string): Promise<PickedFolder | null> => {
    await loadScript('https://apis.google.com/js/api.js');
    await new Promise<void>((resolve) => window.gapi.load('picker', () => resolve()));
    const { google } = window;

    return new Promise((resolve) => {
        const view = new google.picker.DocsView(google.picker.ViewId.FOLDERS)
            .setIncludeFolders(true)
            .setSelectFolderEnabled(true)
            .setEnableDrives(true)
            .setMimeTypes('application/vnd.google-apps.folder');

        const picker = new google.picker.PickerBuilder()
            .addView(view)
            .enableFeature(google.picker.Feature.SUPPORT_DRIVES)
            .setOAuthToken(accessToken)
            .setDeveloperKey(process.env.NEXT_PUBLIC_GOOGLE_PICKER_API_KEY)
            .setAppId(process.env.NEXT_PUBLIC_GOOGLE_CLOUD_APP_ID)
            .setTitle('Escolha a pasta onde o BentiFiles vai salvar os documentos')
            .setCallback((data: any) => {
                if (data.action === google.picker.Action.PICKED) {
                    const doc = data.docs?.[0];
                    resolve(doc ? { folderId: doc.id, sharedDriveId: doc.driveId ?? null } : null);
                } else if (data.action === google.picker.Action.CANCEL) {
                    resolve(null);
                }
            })
            .build();
        picker.setVisible(true);
    });
};
