import { CloudConfigs } from '../msgs'
import { CloudProviderType } from '../msgs/enums'
import { makeDirectory } from '../utils/file.utils'
import { AwsSimpleStorage, CloudStorage } from './storage.service'

export default class CloudService {
    private static instance: CloudService
    private cloudConfigs: CloudConfigs

    private constructor(configs: CloudConfigs) {
        this.cloudConfigs = configs
    }

    public static getInstance(
        configs: CloudConfigs = {
            cloud_provider: CloudProviderType.AWS,
            primary_account: {
                region: 'us-east-1',
                access_key: '',
                secret_access_key: '',
            }
        }
    ): CloudService {
        if (!CloudService.instance) {
            makeDirectory(configs.primary_account?.local?.temp_folder ?? 'tmp/zip')
            CloudService.instance = new CloudService(configs)
        }

        return CloudService.instance
    }

    public getStorageServie(configs: CloudConfigs = {} as CloudConfigs): CloudStorage {
        let _configs: CloudConfigs = { ...this.cloudConfigs, ...configs };
        switch (this.cloudConfigs.cloud_provider) {
            case CloudProviderType.AWS:
                return new AwsSimpleStorage(_configs)
            default:
                throw new Error(
                    `cloud storage servie not implemented  [${this.cloudConfigs.cloud_provider}]`
                )
        }
    }
}
