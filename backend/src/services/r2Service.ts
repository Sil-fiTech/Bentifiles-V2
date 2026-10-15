import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

const r2 = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
    },
});

const requireBucket = (): string => {
    const bucketName = process.env.R2_BUCKET_NAME;
    if (!bucketName) throw new Error("R2_BUCKET_NAME not defined in environment");
    return bucketName;
};

export const putObject = async (key: string, body: Buffer): Promise<void> => {
    await r2.send(new PutObjectCommand({
        Bucket: requireBucket(),
        Key: key,
        Body: body,
        ContentType: 'application/octet-stream',
    }));
};

export const getObject = async (key: string): Promise<Buffer> => {
    const response = await r2.send(new GetObjectCommand({ Bucket: requireBucket(), Key: key }));
    if (!response.Body) throw new Error("Empty response body from R2");
    return Buffer.from(await response.Body.transformToByteArray());
};

export const deleteObject = async (key: string): Promise<void> => {
    await r2.send(new DeleteObjectCommand({ Bucket: requireBucket(), Key: key }));
};
