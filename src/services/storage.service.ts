import AdmZip from 'adm-zip'
import { S3 } from 'aws-sdk'
import { ManagedUpload, PutObjectRequest } from 'aws-sdk/clients/s3'
import * as fs from 'fs'
import { nanoid } from 'nanoid'
import { CloudConfigs, FileDownloadResponse } from '../msgs'
import { deleteTemporaryFile } from '../utils/file.utils'

export abstract class CloudStorage {
    protected configs: CloudConfigs

    public constructor(config: CloudConfigs) {
        this.configs = config
    }

    abstract downloadZipedFiles(
        bucket_name: string,
        file_list: string[],
        ziped_filename?: string,
        utilize_primary_account_only?: boolean
    ): Promise<FileDownloadResponse>

    abstract getSignedUrl(
        params: any,
        utilize_primary_account: boolean,
        operation: string
    ): string

    abstract uploadToS3(
        params: PutObjectRequest,
        utilize_primary_account: boolean
    ): Promise<{ success: boolean; error: any }>
}

export class AwsSimpleStorage extends CloudStorage {
    private primaryS3Client: S3
    private secondaryS3Client: S3

    public constructor(configs: CloudConfigs) {
        super(configs)
        const secondary_cloud_credentials =
            configs.secondary_account ?? configs.primary_account
        this.primaryS3Client = new S3({
            accessKeyId: configs.primary_account.access_key,
            secretAccessKey: configs.primary_account.secret_access_key,
            region: configs.primary_account.region,
        })
        this.secondaryS3Client = new S3({
            accessKeyId: secondary_cloud_credentials.access_key,
            secretAccessKey: secondary_cloud_credentials.secret_access_key,
            region: secondary_cloud_credentials.region,
        })
    }

    async downloadZipedFiles(
        bucket_name: string,
        file_list: [string],
        ziped_filename: string,
        utilize_primary_account_only: boolean = false
    ): Promise<FileDownloadResponse> {
        let settings = this.configs.primary_account
        let temp_zip_filename = `${ziped_filename}_${nanoid(8)}.zip`
        let temp_zip_filepath = `${
            settings.local?.temp_folder ?? 'tmp/zip'
        }/${temp_zip_filename}`
        try {
            const zip = new AdmZip()
            for (const file of file_list) {
                const params = {
                    Bucket: bucket_name,
                    Key: file,
                }
                const payload = await this.primaryS3Client
                    .getObject(params)
                    .promise()
                zip.addFile(file, Buffer.from(payload.Body as Buffer))
            }
            let file_written: boolean =
                await zip.writeZipPromise(temp_zip_filepath)
            if (!file_written) {
                return {
                    error: new Error(
                        `file zip failed [filenmae=${temp_zip_filepath}]`
                    ),
                    success: false,
                    payload: null,
                } as FileDownloadResponse
            }
            let temp_settings = utilize_primary_account_only
                ? this.configs.primary_account
                : this.configs.secondary_account
            let { success, error } = await this.uploadToS3(
                {
                    Bucket: temp_settings.storage?.tempory_bucket,
                    Key: temp_zip_filename,
                    Body: fs.createReadStream(temp_zip_filepath),
                },
                utilize_primary_account_only
            )

            if (!success) {
                return {
                    error: error,
                    success: false,
                    payload: null,
                } as FileDownloadResponse
            }

            let download_link = this.getSignedUrl(
                {
                    Bucket: temp_settings.storage?.tempory_bucket,
                    Key: temp_zip_filename,
                    Expires: temp_settings.storage?.signed_expires ?? 900,
                },
                utilize_primary_account_only
            )

            deleteTemporaryFile(temp_zip_filepath)

            return {
                success: true,
                error: null,
                payload: {
                    download_link,
                    filename: temp_zip_filename,
                },
            } as FileDownloadResponse
        } catch (ex) {
            console.error(
                'error occured while downloading bulk zip files ' + ex
            )
            return {
                error: ex,
                success: false,
                payload: null,
            } as FileDownloadResponse
        }
    }

    async uploadToS3(
        params: PutObjectRequest,
        utilize_primary_account: boolean = false
    ): Promise<{ success: boolean; error: any }> {
        return new Promise((resolve) => {
            let s3Client = utilize_primary_account
                ? this.primaryS3Client
                : this.secondaryS3Client
            s3Client.upload(
                params,
                (err: Error, data: ManagedUpload.SendData) => {
                    if (err) resolve({ success: false, error: err })
                    else resolve({ success: true, error: null })
                }
            )
        })
    }

    public getSignedUrl(
        params: any,
        utilize_primary_account: boolean = false,
        operation: string = 'getObject'
    ): string {
        let s3Client = utilize_primary_account
            ? this.primaryS3Client
            : this.secondaryS3Client
        return s3Client.getSignedUrl(operation, params)
    }
}
