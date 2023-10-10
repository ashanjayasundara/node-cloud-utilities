import AdmZip from 'adm-zip'
import { S3 } from 'aws-sdk'
import { ManagedUpload, PutObjectRequest } from 'aws-sdk/clients/s3'
import { nanoid } from 'nanoid'
import { CloudConfigMsg, FileDownloadResponse } from '../msgs'
import * as fs from 'fs'
import { deleteTemporaryFile } from '../utils/file.utils'

export abstract class CloudStorage {
    protected configs: CloudConfigMsg

    public constructor(config: CloudConfigMsg) {
        this.configs = config
    }

    abstract downloadZipedFiles(
        bucket_name: string,
        file_list: string[],
        ziped_filename?: string
    ): Promise<FileDownloadResponse>
}

export class AwsSimpleStorage extends CloudStorage {
    private s3Client: S3

    public constructor(configs: CloudConfigMsg) {
        super(configs)
        this.s3Client = new S3({
            accessKeyId: configs.access_key,
            secretAccessKey: configs.secret_access_key,
            region: configs.region,
        })
    }

    async downloadZipedFiles(
        bucket_name: string,
        file_list: [string],
        ziped_filename?: string
    ): Promise<FileDownloadResponse> {
        let temp_zip_filename = `${ziped_filename}_${nanoid(8)}.zip`
        let temp_zip_filepath = `${
            this.configs.local?.temp_folder ?? 'tmp/zip'
        }/${temp_zip_filename}`
        try {
            const zip = new AdmZip()
            for (const file of file_list) {
                const params = {
                    Bucket: bucket_name,
                    Key: file,
                }
                const payload = await this.s3Client.getObject(params).promise()
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

            let { success, error } = await this.uploadToS3({
                Bucket: this.configs.storage.tempory_bucket,
                Key: temp_zip_filename,
                Body: fs.createReadStream(temp_zip_filepath),
            })

            if (!success) {
                return {
                    error: error,
                    success: false,
                    payload: null,
                } as FileDownloadResponse
            }

            let download_link = this.getSignedUrl({
                Bucket: this.configs.storage.tempory_bucket,
                Key: temp_zip_filename,
                Expires: this.configs.storage.signed_expires ?? 900,
            })

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
        params: PutObjectRequest
    ): Promise<{ success: boolean; error: any }> {
        return new Promise((resolve) => {
            this.s3Client.upload(
                params,
                (err: Error, data: ManagedUpload.SendData) => {
                    if (err) resolve({ success: false, error: err })
                    else resolve({ success: true, error: null })
                }
            )
        })
    }

    public getSignedUrl(params: any, operation: string = 'getObject'): string {
        return this.s3Client.getSignedUrl(operation, params)
    }
}
