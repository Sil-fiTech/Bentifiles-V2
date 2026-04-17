import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "crypto";

const r2 = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
    },
});

export const uploadToR2 = async (fileBody: any, mimetype: string, savedFilename: string): Promise<string> => {
    const bucketName = process.env.R2_BUCKET_NAME;
    if (!bucketName) throw new Error("R2_BUCKET_NAME not defined in environment");

    // Map allowed MIME types to secure, hardcoded extensions
    const mimeToExt: Record<string, string> = {
        'image/jpeg': '.jpg',
        'image/png': '.png',
        'application/pdf': '.pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx'
    };

    const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: savedFilename,
        Body: fileBody,
        ContentType: mimetype,
    });

    await r2.send(command);
    console.log("File uploaded to R2 successfully");
    return savedFilename; // Store only the filename in the DB
};

export const getFileUrl = async (filename: string): Promise<string> => {
    const bucketName = process.env.R2_BUCKET_NAME;
    if (!bucketName) throw new Error("R2_BUCKET_NAME not defined in environment");

    if (process.env.R2_PUBLIC_URL) {
        return `${process.env.R2_PUBLIC_URL}/${filename}`;
    }

    const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: filename,
    });

    // Generate a pre-signed URL valid for 1 hour
    return await getSignedUrl(r2, command, { expiresIn: 3600 });
};

export const getFileFromR2 = async (filename: string): Promise<{ buffer: Buffer, contentType: string }> => {
    const bucketName = process.env.R2_BUCKET_NAME;
    if (!bucketName) throw new Error("R2_BUCKET_NAME not defined in environment");

    const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: filename,
    });

    const response = await r2.send(command);

    if (!response.Body) {
        throw new Error("Empty response body from R2");
    }

    // Convert the readable stream to a buffer
    const stream = response.Body as NodeJS.ReadableStream;
    const buffer = await new Promise<Buffer>((resolve, reject) => {
        const chunks: Buffer[] = [];
        stream.on('data', chunk => chunks.push(chunk));
        stream.on('error', reject);
        stream.on('end', () => resolve(Buffer.concat(chunks)));
    });

    return {
        buffer,
        contentType: response.ContentType || 'application/octet-stream'
    };

};
