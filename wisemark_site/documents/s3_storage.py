"""
S3 storage for PDFs. When AWS_STORAGE_BUCKET_NAME is set, new uploads go to S3
instead of Postgres. Existing documents keep using their current storage_location.
"""
import logging

from django.conf import settings

logger = logging.getLogger(__name__)

# Key prefix for all PDF objects
S3_PREFIX = "pdfs/"


def is_s3_configured():
    """True if S3 should be used for new PDF uploads."""
    return bool(getattr(settings, "AWS_STORAGE_BUCKET_NAME", None))


def _get_client():
    """Lazy boto3 client; only imported when S3 is used."""
    import boto3
    return boto3.client(
        "s3",
        region_name=getattr(settings, "AWS_S3_REGION_NAME", "eu-west-2"),
        aws_access_key_id=getattr(settings, "AWS_ACCESS_KEY_ID", None),
        aws_secret_access_key=getattr(settings, "AWS_SECRET_ACCESS_KEY", None),
    )


def upload_pdf_bytes(pdf_hash: str, file_bytes: bytes) -> str:
    """
    Upload PDF bytes to S3. Key is pdfs/{pdf_hash}.pdf.
    Returns the S3 key (for storing in Document.s3_key).
    """
    bucket = settings.AWS_STORAGE_BUCKET_NAME
    key = f"{S3_PREFIX}{pdf_hash}.pdf"
    client = _get_client()
    client.put_object(
        Bucket=bucket,
        Key=key,
        Body=file_bytes,
        ContentType="application/pdf",
    )
    return key


def get_pdf_bytes(s3_key: str) -> bytes | None:
    """Fetch PDF bytes from S3. Returns None on error."""
    try:
        client = _get_client()
        resp = client.get_object(
            Bucket=settings.AWS_STORAGE_BUCKET_NAME,
            Key=s3_key,
        )
        return resp["Body"].read()
    except Exception as e:
        logger.exception("Failed to get PDF from S3 key=%s: %s", s3_key, e)
        return None


def delete_pdf(s3_key: str) -> None:
    """Delete a PDF object from S3. Safe to call if object is missing."""
    try:
        client = _get_client()
        client.delete_object(
            Bucket=settings.AWS_STORAGE_BUCKET_NAME,
            Key=s3_key,
        )
    except Exception as e:
        logger.warning("Failed to delete S3 object key=%s: %s", s3_key, e)
