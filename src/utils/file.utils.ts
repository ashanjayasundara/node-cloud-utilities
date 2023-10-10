import * as fs from 'fs'

export const makeDirectory = (path: string) => {
    if (!fs.existsSync(path)) {
        fs.mkdirSync(path, { recursive: true })
    }
    return path
}

export const isFileExits = (file: string): Promise<boolean> => {
    return new Promise((resolve, reject) => {
        fs.access(file, fs.constants.F_OK, (err) => {
            if (err) {
                return resolve(false)
            }
            return resolve(true)
        })
    })
}

export const deleteTemporaryFile = (file: string) => {
    if (fs.existsSync(file)) {
        fs.unlinkSync(file)
    }
}
