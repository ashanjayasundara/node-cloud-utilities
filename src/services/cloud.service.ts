import { CloudConfigMsg } from '../msgs'
import { CloudProviderType } from '../msgs/enums'
import { makeDirectory } from '../utils/file.utils'
import { AwsSimpleStorage, CloudStorage } from './storage.service'

export default class CloudService {
    private static instance: CloudService
    private cloudConfigs: CloudConfigMsg

    private constructor(configs: CloudConfigMsg) {
        this.cloudConfigs = configs
    }

    public static getInstance(
        configs: CloudConfigMsg = {
            region: 'us-east-1',
            access_key: '',
            cloud_provider: CloudProviderType.AWS,
            secret_access_key: '',
        }
    ): CloudService {
        if (!CloudService.instance) {
            makeDirectory(configs.local?.temp_folder ?? 'tmp/zip')
            CloudService.instance = new CloudService(configs)
        }

        return CloudService.instance
    }

    public getStorageServie(): CloudStorage {
        switch (this.cloudConfigs.cloud_provider) {
            case CloudProviderType.AWS:
                return new AwsSimpleStorage(this.cloudConfigs)
            default:
                throw new Error(
                    `cloud storage servie not implemented  [${this.cloudConfigs.cloud_provider}]`
                )
        }
    }
}
