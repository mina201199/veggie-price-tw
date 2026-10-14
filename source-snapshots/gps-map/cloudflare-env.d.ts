declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    SYSTEM_BACKUP_GRANT?: string;
  }
}
