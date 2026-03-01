# S3 bucket setup for WiseMark PDFs

WiseMark can store PDFs in AWS S3 instead of Postgres. When S3 is configured, **new** uploads go to S3; existing documents keep using their current storage (Postgres or S3).

---

## 1. Create an S3 bucket (AWS Console)

1. Log in to [AWS Console](https://console.aws.amazon.com/) and open **S3**.
2. Click **Create bucket**.
3. **Bucket name**: e.g. `wisemark-pdfs-prod` (must be globally unique).
4. **Region**: Choose one (e.g. `eu-west-2`). Use the same in `AWS_S3_REGION_NAME` later.
5. **Block Public Access**: leave **all** blocked (default). The app will access objects with IAM credentials, not public URLs.
6. **Bucket Versioning**: optional (can help with recovery).
7. Click **Create bucket**.

---

## 2. Create an IAM user for the app

1. Open **IAM** → **Users** → **Create user**.
2. **User name**: e.g. `wisemark-s3-pdfs`.
3. **Provide user access to the AWS Console**: optional (not needed if you only use API keys).
4. Click **Next**.
5. **Set permissions**: **Attach policies directly** → **Create policy** (opens new tab).
   - **JSON** tab, use:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "WiseMarkPdfBucket",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::YOUR-BUCKET-NAME",
        "arn:aws:s3:::YOUR-BUCKET-NAME/*"
      ]
    }
  ]
}
```

   - Replace `YOUR-BUCKET-NAME` with your bucket name (e.g. `wisemark-pdfs-prod`).
   - Name the policy e.g. `WiseMarkS3PdfAccess` → **Create policy**.
6. Back in the user creation tab, refresh and attach **WiseMarkS3PdfAccess** (or the name you used).
7. **Next** → **Create user**.

---

## 3. Create access keys for the IAM user

1. Open the user you created → **Security credentials** tab.
2. **Access keys** → **Create access key**.
3. Use case: **Application running outside AWS** (or **Command Line Interface** if you prefer).
4. **Next** → **Create access key**.
5. Copy the **Access key ID** and **Secret access key** (you won’t see the secret again). Store them somewhere safe (e.g. password manager or env vars).

---

## 4. Configure Django (env vars)

Set these in your environment (e.g. Railway **Variables**, or `.env` locally). **Do not** commit the secret key.

| Variable | Example | Required |
|----------|--------|----------|
| `AWS_ACCESS_KEY_ID` | `AKIA...` | Yes (if using S3) |
| `AWS_SECRET_ACCESS_KEY` | `...` | Yes (if using S3) |
| `AWS_STORAGE_BUCKET_NAME` | `wisemark-pdfs-prod` | Yes (if using S3) |
| `AWS_S3_REGION_NAME` | `eu-west-2` | No (default `eu-west-2`) |

- If **only** `AWS_STORAGE_BUCKET_NAME` is set (and keys are set), new PDF uploads go to S3.
- If `AWS_STORAGE_BUCKET_NAME` is **not** set, all uploads stay in Postgres (current behaviour).

---

## 5. Deploy and test

1. Install dependencies: `pip install -r requirements.txt` (adds `boto3`).
2. Set the four env vars and redeploy (e.g. on Railway).
3. Upload a new PDF in the app → it should be stored in S3.
4. Open that document in the viewer → the app will stream the PDF from S3 via the existing `/api/documents/<id>/pdf/` endpoint.

---

## 6. Object layout in S3

- **Prefix**: `pdfs/`
- **Key**: `pdfs/{sha256_hash}.pdf` (hash of the file).
- Same file (same hash) can be referenced by multiple documents; only one object is stored per hash.

---

## 7. Optional: migrate existing Postgres PDFs to S3

Existing documents with `storage_location=postgres` are unchanged. To move them to S3 you’d need a one-off script or management command that:

1. Lists documents with `storage_location='postgres'` and non-null `pdf_file`.
2. For each: upload `pdf_file` to S3 with `upload_pdf_bytes(pdf_hash, bytes(pdf_file))`, then set `storage_location='s3'`, `s3_key=key`, `pdf_file=None` and save.

If you want, we can add a `manage.py` command for this.
