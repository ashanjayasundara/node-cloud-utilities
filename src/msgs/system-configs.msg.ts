import { CloudProviderType } from './enums'

export interface CloudConfigMsg {
    access_key: string
    secret_access_key: string
    region: string
    storage?: {
        tempory_bucket: string
        signed_expires: number
    }
    local?: {
        temp_folder: string
    }
}

export interface FileDownloadResponse {
    error: any
    success: boolean
    payload: {
        download_link: string
        filename: string
    }
}

export interface CloudConfigs {
    cloud_provider?: CloudProviderType
    primary_account: CloudConfigMsg
    secondary_account?: CloudConfigMsg
}