import * as SQLite from "expo-sqlite";

// ─── Database Setup ───────────────────────────────────────────────────────────

const DB_NAME = "fieldreportx.db";

let db: SQLite.SQLiteDatabase | null = null;

export const getDb = async (): Promise<SQLite.SQLiteDatabase> => {
  if (!db) {
    db = await SQLite.openDatabaseAsync(DB_NAME);
    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      PRAGMA busy_timeout = 5000;
    `);
  }
  return db;
};

// ─── Initialise Schema ────────────────────────────────────────────────────────

const initialise = async (): Promise<void> => {
  const database = await getDb();
  await database.execAsync(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS "User" (
      userId            INTEGER PRIMARY KEY AUTOINCREMENT,
      userDisplayName   TEXT,
      userEmail         TEXT NOT NULL UNIQUE,
      userFirebaseUid   TEXT UNIQUE,
      userTheme         TEXT DEFAULT 'light',
      createdAt         TEXT DEFAULT (datetime('now')),
      updatedAt         TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS Business_Profile (
      companyId           INTEGER PRIMARY KEY AUTOINCREMENT,
      userId              INTEGER NOT NULL,
      companyName         TEXT,
      companyEmail        TEXT,
      companyWebsite      TEXT,
      companyAddress      TEXT,
      companyPhoneNumber  TEXT,
      companyLogo         TEXT,
      createdAt           TEXT DEFAULT (datetime('now')),
      updatedAt           TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (userId) REFERENCES "User"(userId) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS Report_Template (
      reportTemplateId                    INTEGER PRIMARY KEY AUTOINCREMENT,
      userId                              INTEGER NOT NULL,
      reportTemplateName                  TEXT,
      reportTemplateCategory              TEXT,
      reportTemplateLayout                TEXT,
      reportTemplateLayoutLogo            INTEGER DEFAULT 0,
      reportTemplateLayoutCompanyName     INTEGER DEFAULT 0,
      reportTemplateLayoutContactDetails  INTEGER DEFAULT 0,
      reportTemplateFieldCount            INTEGER,
      reportTemplateVersion               INTEGER,
      reportTemplateShared                INTEGER DEFAULT 0,
      createdAt                           TEXT DEFAULT (datetime('now')),
      updatedAt                           TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (userId) REFERENCES "User"(userId) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS Report_Field_Templates (
      fieldTemplateId       INTEGER PRIMARY KEY AUTOINCREMENT,
      reportTemplateId      INTEGER NOT NULL,
      fieldTemplateLabel    TEXT,
      fieldTemplateType     TEXT,
      fieldTemplateRequired INTEGER DEFAULT 0,
      fieldOrderNumber      INTEGER,
      createdAt             TEXT DEFAULT (datetime('now')),
      updatedAt             TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (reportTemplateId) REFERENCES Report_Template(reportTemplateId) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS Report (
      reportId                      INTEGER PRIMARY KEY AUTOINCREMENT,
      userId                        INTEGER NOT NULL,
      reportName                    TEXT,
      reportCategory                TEXT,
      reportLayout                  TEXT,
      reportLayoutLogo              INTEGER DEFAULT 0,
      reportLayoutCompanyName       INTEGER DEFAULT 0,
      reportLayoutContactDetails    INTEGER DEFAULT 0,
      reportFieldCount              INTEGER,
      reportStatus                  TEXT,
      reportChecksum                TEXT,
      reportCreatedWithAppVersion   TEXT,
      createdAt                     TEXT DEFAULT (datetime('now')),
      updatedAt                     TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (userId) REFERENCES "User"(userId) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS Report_Field (
      fieldId          INTEGER PRIMARY KEY AUTOINCREMENT,
      reportId         INTEGER NOT NULL,
      fieldLabel       TEXT,
      fieldType        TEXT,
      fieldRequired    INTEGER DEFAULT 0,
      fieldOrderNumber INTEGER,
      fieldData        TEXT,
      createdAt        TEXT DEFAULT (datetime('now')),
      updatedAt        TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (reportId) REFERENCES Report(reportId) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS Report_Sensor_Data (
      sensorDataId        INTEGER PRIMARY KEY AUTOINCREMENT,
      fieldId             INTEGER NOT NULL,
      sensorDataType      TEXT,
      sensorDataResults   TEXT,
      sensorDataTimestamp TEXT,
      createdAt           TEXT DEFAULT (datetime('now')),
      updatedAt           TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (fieldId) REFERENCES Report_Field(fieldId) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS Report_Media (
      mediaId        INTEGER PRIMARY KEY AUTOINCREMENT,
      fieldId        INTEGER NOT NULL,
      mediaType      TEXT,
      mediaUrl       TEXT,
      mediaGPS       TEXT,
      mediaTimestamp TEXT,
      createdAt      TEXT DEFAULT (datetime('now')),
      updatedAt      TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (fieldId) REFERENCES Report_Field(fieldId) ON DELETE CASCADE
    );
  `);
};

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UserRow {
  userId?: number;
  userDisplayName?: string | null;
  userEmail: string;
  userFirebaseUid?: string | null;
  userTheme?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface BusinessProfileRow {
  companyId?: number;
  userId: number;
  companyName?: string | null;
  companyEmail?: string | null;
  companyWebsite?: string | null;
  companyAddress?: string | null;
  companyPhoneNumber?: string | null;
  companyLogo?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface ReportTemplateRow {
  reportTemplateId?: number;
  userId: number;
  reportTemplateName?: string | null;
  reportTemplateCategory?: string | null;
  reportTemplateLayout?: string | null;
  reportTemplateLayoutLogo?: number;
  reportTemplateLayoutCompanyName?: number;
  reportTemplateLayoutContactDetails?: number;
  reportTemplateFieldCount?: number | null;
  reportTemplateVersion?: number | null;
  reportTemplateShared?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ReportFieldTemplateRow {
  fieldTemplateId?: number;
  reportTemplateId: number;
  fieldTemplateLabel?: string | null;
  fieldTemplateType?: string | null;
  fieldTemplateRequired?: number;
  fieldOrderNumber?: number | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface ReportRow {
  reportId?: number;
  userId: number;
  reportName?: string | null;
  reportCategory?: string | null;
  reportLayout?: string | null;
  reportLayoutLogo?: number;
  reportLayoutCompanyName?: number;
  reportLayoutContactDetails?: number;
  reportFieldCount?: number | null;
  reportStatus?: string | null;
  reportChecksum?: string | null;
  reportCreatedWithAppVersion?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface ReportFieldRow {
  fieldId?: number;
  reportId: number;
  fieldLabel?: string | null;
  fieldType?: string | null;
  fieldRequired?: number;
  fieldOrderNumber?: number | null;
  fieldData?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface ReportSensorDataRow {
  sensorDataId?: number;
  fieldId: number;
  sensorDataType?: string | null;
  sensorDataResults?: string | null;
  sensorDataTimestamp?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface ReportMediaRow {
  mediaId?: number;
  fieldId: number;
  mediaType?: string | null;
  mediaUrl?: string | null;
  mediaGPS?: string | null;
  mediaTimestamp?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

// ─── Timestamp helper ─────────────────────────────────────────────────────────

const now = () => new Date().toISOString();

// ─── SQLite Helper ────────────────────────────────────────────────────────────

export const sqliteHelper = {
  /** Run once on app startup to create all tables */
  initialise,

  // ── User ──────────────────────────────────────────────────────────────────

  user: {
    /** Insert a new user row. Returns the new userId. */
    save: async (user: UserRow): Promise<number> => {
      const database = await getDb();
      const result = await database.runAsync(
        `INSERT INTO "User" (userDisplayName, userEmail, userFirebaseUid, userTheme, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?)`,
        [
          user.userDisplayName ?? null,
          user.userEmail,
          user.userFirebaseUid ?? null,
          user.userTheme ?? "light",
          now(),
          now(),
        ],
      );
      return result.lastInsertRowId;
    },

    /** Load a user by their local userId. */
    getById: async (userId: number): Promise<UserRow | null> => {
      const database = await getDb();
      return await database.getFirstAsync<UserRow>(
        `SELECT * FROM "User" WHERE userId = ?`,
        [userId],
      );
    },

    /** Load a user by their Firebase UID — useful after login. */
    getByFirebaseUid: async (firebaseUid: string): Promise<UserRow | null> => {
      const database = await getDb();
      return await database.getFirstAsync<UserRow>(
        `SELECT * FROM "User" WHERE userFirebaseUid = ?`,
        [firebaseUid],
      );
    },

    /** Load a user by email. */
    getByEmail: async (email: string): Promise<UserRow | null> => {
      const database = await getDb();
      return await database.getFirstAsync<UserRow>(
        `SELECT * FROM "User" WHERE userEmail = ?`,
        [email],
      );
    },

    /** Update editable user fields. */
    update: async (
      userId: number,
      updates: Partial<UserRow>,
    ): Promise<void> => {
      const database = await getDb();
      await database.runAsync(
        `UPDATE "User"
        SET userDisplayName = ?, userEmail = ?, userTheme = ?, updatedAt = ?
        WHERE userId = ?`,
        [
          updates.userDisplayName ?? null,
          updates.userEmail ?? null,
          updates.userTheme ?? "light",
          now(),
          userId,
        ],
      );
    },

    /** Update only the userTheme column — avoids touching NOT NULL fields. */
    updateTheme: async (userId: number, theme: string): Promise<void> => {
      const database = await getDb();
      await database.runAsync(
        `UPDATE "User" SET userTheme = ?, updatedAt = ? WHERE userId = ?`,
        [theme, now(), userId],
      );
    },

    /** Delete a user and all cascaded records. */
    delete: async (userId: number): Promise<void> => {
      const database = await getDb();
      await database.runAsync(`DELETE FROM "User" WHERE userId = ?`, [userId]);
    },
  },

  // ── Business Profile ──────────────────────────────────────────────────────

  businessProfile: {
    save: async (profile: BusinessProfileRow): Promise<number> => {
      const database = await getDb();
      const result = await database.runAsync(
        `INSERT INTO Business_Profile
           (userId, companyName, companyEmail, companyWebsite, companyAddress, companyPhoneNumber, companyLogo, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          profile.userId,
          profile.companyName ?? null,
          profile.companyEmail ?? null,
          profile.companyWebsite ?? null,
          profile.companyAddress ?? null,
          profile.companyPhoneNumber ?? null,
          profile.companyLogo ?? null,
          now(),
          now(),
        ],
      );
      return result.lastInsertRowId;
    },

    getByUserId: async (userId: number): Promise<BusinessProfileRow | null> => {
      const database = await getDb();
      return await database.getFirstAsync<BusinessProfileRow>(
        `SELECT * FROM Business_Profile WHERE userId = ?`,
        [userId],
      );
    },

    update: async (
      companyId: number,
      updates: Partial<BusinessProfileRow>,
    ): Promise<void> => {
      const database = await getDb();
      await database.runAsync(
        `UPDATE Business_Profile
         SET companyName = ?, companyEmail = ?, companyWebsite = ?,
             companyAddress = ?, companyPhoneNumber = ?, companyLogo = ?, updatedAt = ?
         WHERE companyId = ?`,
        [
          updates.companyName ?? null,
          updates.companyEmail ?? null,
          updates.companyWebsite ?? null,
          updates.companyAddress ?? null,
          updates.companyPhoneNumber ?? null,
          updates.companyLogo ?? null,
          now(),
          companyId,
        ],
      );
    },

    delete: async (companyId: number): Promise<void> => {
      const database = await getDb();
      await database.runAsync(
        `DELETE FROM Business_Profile WHERE companyId = ?`,
        [companyId],
      );
    },
  },

  // ── Report Template ───────────────────────────────────────────────────────

  reportTemplate: {
    save: async (template: ReportTemplateRow): Promise<number> => {
      const database = await getDb();
      const result = await database.runAsync(
        `INSERT INTO Report_Template
           (userId, reportTemplateName, reportTemplateCategory, reportTemplateLayout,
            reportTemplateLayoutLogo, reportTemplateLayoutCompanyName,
            reportTemplateLayoutContactDetails, reportTemplateFieldCount,
            reportTemplateVersion, reportTemplateShared, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          template.userId,
          template.reportTemplateName ?? null,
          template.reportTemplateCategory ?? null,
          template.reportTemplateLayout ?? null,
          template.reportTemplateLayoutLogo ?? 0,
          template.reportTemplateLayoutCompanyName ?? 0,
          template.reportTemplateLayoutContactDetails ?? 0,
          template.reportTemplateFieldCount ?? null,
          template.reportTemplateVersion ?? null,
          template.reportTemplateShared ?? 0,
          now(),
          now(),
        ],
      );
      return result.lastInsertRowId;
    },

    getById: async (
      reportTemplateId: number,
    ): Promise<ReportTemplateRow | null> => {
      const database = await getDb();
      return await database.getFirstAsync<ReportTemplateRow>(
        `SELECT * FROM Report_Template WHERE reportTemplateId = ?`,
        [reportTemplateId],
      );
    },

    getAllByUserId: async (userId: number): Promise<ReportTemplateRow[]> => {
      const database = await getDb();
      return await database.getAllAsync<ReportTemplateRow>(
        `SELECT * FROM Report_Template WHERE userId = ? ORDER BY createdAt DESC`,
        [userId],
      );
    },

    update: async (
      reportTemplateId: number,
      updates: Partial<ReportTemplateRow>,
    ): Promise<void> => {
      const database = await getDb();
      await database.runAsync(
        `UPDATE Report_Template
         SET reportTemplateName = ?, reportTemplateCategory = ?, reportTemplateLayout = ?,
             reportTemplateLayoutLogo = ?, reportTemplateLayoutCompanyName = ?,
             reportTemplateLayoutContactDetails = ?, reportTemplateFieldCount = ?,
             reportTemplateVersion = ?, reportTemplateShared = ?, updatedAt = ?
         WHERE reportTemplateId = ?`,
        [
          updates.reportTemplateName ?? null,
          updates.reportTemplateCategory ?? null,
          updates.reportTemplateLayout ?? null,
          updates.reportTemplateLayoutLogo ?? 0,
          updates.reportTemplateLayoutCompanyName ?? 0,
          updates.reportTemplateLayoutContactDetails ?? 0,
          updates.reportTemplateFieldCount ?? null,
          updates.reportTemplateVersion ?? null,
          updates.reportTemplateShared ?? 0,
          now(),
          reportTemplateId,
        ],
      );
    },

    delete: async (reportTemplateId: number): Promise<void> => {
      const database = await getDb();
      await database.runAsync(
        `DELETE FROM Report_Template WHERE reportTemplateId = ?`,
        [reportTemplateId],
      );
    },
  },

  // ── Report Field Templates ────────────────────────────────────────────────

  reportFieldTemplate: {
    save: async (field: ReportFieldTemplateRow): Promise<number> => {
      const database = await getDb();
      const result = await database.runAsync(
        `INSERT INTO Report_Field_Templates
           (reportTemplateId, fieldTemplateLabel, fieldTemplateType, fieldTemplateRequired, fieldOrderNumber, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          field.reportTemplateId,
          field.fieldTemplateLabel ?? null,
          field.fieldTemplateType ?? null,
          field.fieldTemplateRequired ?? 0,
          field.fieldOrderNumber ?? null,
          now(),
          now(),
        ],
      );
      return result.lastInsertRowId;
    },

    getAllByTemplateId: async (
      reportTemplateId: number,
    ): Promise<ReportFieldTemplateRow[]> => {
      const database = await getDb();
      return await database.getAllAsync<ReportFieldTemplateRow>(
        `SELECT * FROM Report_Field_Templates WHERE reportTemplateId = ? ORDER BY fieldOrderNumber`,
        [reportTemplateId],
      );
    },

    update: async (
      fieldTemplateId: number,
      updates: Partial<ReportFieldTemplateRow>,
    ): Promise<void> => {
      const database = await getDb();
      await database.runAsync(
        `UPDATE Report_Field_Templates
         SET fieldTemplateLabel = ?, fieldTemplateType = ?, fieldTemplateRequired = ?, fieldOrderNumber = ?, updatedAt = ?
         WHERE fieldTemplateId = ?`,
        [
          updates.fieldTemplateLabel ?? null,
          updates.fieldTemplateType ?? null,
          updates.fieldTemplateRequired ?? 0,
          updates.fieldOrderNumber ?? null,
          now(),
          fieldTemplateId,
        ],
      );
    },

    delete: async (fieldTemplateId: number): Promise<void> => {
      const database = await getDb();
      await database.runAsync(
        `DELETE FROM Report_Field_Templates WHERE fieldTemplateId = ?`,
        [fieldTemplateId],
      );
    },
  },

  // ── Report ────────────────────────────────────────────────────────────────

  report: {
    save: async (report: ReportRow): Promise<number> => {
      const database = await getDb();
      const result = await database.runAsync(
        `INSERT INTO Report
           (userId, reportName, reportCategory, reportLayout, reportLayoutLogo,
            reportLayoutCompanyName, reportLayoutContactDetails, reportFieldCount,
            reportStatus, reportChecksum, reportCreatedWithAppVersion, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          report.userId,
          report.reportName ?? null,
          report.reportCategory ?? null,
          report.reportLayout ?? null,
          report.reportLayoutLogo ?? 0,
          report.reportLayoutCompanyName ?? 0,
          report.reportLayoutContactDetails ?? 0,
          report.reportFieldCount ?? null,
          report.reportStatus ?? null,
          report.reportChecksum ?? null,
          report.reportCreatedWithAppVersion ?? null,
          now(),
          now(),
        ],
      );
      return result.lastInsertRowId;
    },

    getById: async (reportId: number): Promise<ReportRow | null> => {
      const database = await getDb();
      return await database.getFirstAsync<ReportRow>(
        `SELECT * FROM Report WHERE reportId = ?`,
        [reportId],
      );
    },

    getAllByUserId: async (userId: number): Promise<ReportRow[]> => {
      const database = await getDb();
      return await database.getAllAsync<ReportRow>(
        `SELECT * FROM Report WHERE userId = ? ORDER BY createdAt DESC`,
        [userId],
      );
    },

    update: async (
      reportId: number,
      updates: Partial<ReportRow>,
    ): Promise<void> => {
      const database = await getDb();
      await database.runAsync(
        `UPDATE Report
         SET reportName = ?, reportCategory = ?, reportLayout = ?, reportLayoutLogo = ?,
             reportLayoutCompanyName = ?, reportLayoutContactDetails = ?, reportFieldCount = ?,
             reportStatus = ?, reportChecksum = ?, reportCreatedWithAppVersion = ?, updatedAt = ?
         WHERE reportId = ?`,
        [
          updates.reportName ?? null,
          updates.reportCategory ?? null,
          updates.reportLayout ?? null,
          updates.reportLayoutLogo ?? 0,
          updates.reportLayoutCompanyName ?? 0,
          updates.reportLayoutContactDetails ?? 0,
          updates.reportFieldCount ?? null,
          updates.reportStatus ?? null,
          updates.reportChecksum ?? null,
          updates.reportCreatedWithAppVersion ?? null,
          now(),
          reportId,
        ],
      );
    },

    delete: async (reportId: number): Promise<void> => {
      const database = await getDb();
      await database.runAsync(`DELETE FROM Report WHERE reportId = ?`, [
        reportId,
      ]);
    },
  },

  // ── Report Field ──────────────────────────────────────────────────────────

  reportField: {
    save: async (field: ReportFieldRow): Promise<number> => {
      const database = await getDb();
      const result = await database.runAsync(
        `INSERT INTO Report_Field
           (reportId, fieldLabel, fieldType, fieldRequired, fieldOrderNumber, fieldData, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          field.reportId,
          field.fieldLabel ?? null,
          field.fieldType ?? null,
          field.fieldRequired ?? 0,
          field.fieldOrderNumber ?? null,
          field.fieldData ?? null,
          now(),
          now(),
        ],
      );
      return result.lastInsertRowId;
    },

    getAllByReportId: async (reportId: number): Promise<ReportFieldRow[]> => {
      const database = await getDb();
      return await database.getAllAsync<ReportFieldRow>(
        `SELECT * FROM Report_Field WHERE reportId = ? ORDER BY fieldOrderNumber`,
        [reportId],
      );
    },

    update: async (
      fieldId: number,
      updates: Partial<ReportFieldRow>,
    ): Promise<void> => {
      const database = await getDb();
      await database.runAsync(
        `UPDATE Report_Field
         SET fieldLabel = ?, fieldType = ?, fieldRequired = ?, fieldOrderNumber = ?, fieldData = ?, updatedAt = ?
         WHERE fieldId = ?`,
        [
          updates.fieldLabel ?? null,
          updates.fieldType ?? null,
          updates.fieldRequired ?? 0,
          updates.fieldOrderNumber ?? null,
          updates.fieldData ?? null,
          now(),
          fieldId,
        ],
      );
    },

    delete: async (fieldId: number): Promise<void> => {
      const database = await getDb();
      await database.runAsync(`DELETE FROM Report_Field WHERE fieldId = ?`, [
        fieldId,
      ]);
    },
  },

  // ── Report Sensor Data ────────────────────────────────────────────────────

  reportSensorData: {
    save: async (sensorData: ReportSensorDataRow): Promise<number> => {
      const database = await getDb();
      const result = await database.runAsync(
        `INSERT INTO Report_Sensor_Data (fieldId, sensorDataType, sensorDataResults, sensorDataTimestamp, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          sensorData.fieldId,
          sensorData.sensorDataType ?? null,
          sensorData.sensorDataResults ?? null,
          sensorData.sensorDataTimestamp ?? null,
          now(),
          now(),
        ],
      );
      return result.lastInsertRowId;
    },

    getAllByFieldId: async (
      fieldId: number,
    ): Promise<ReportSensorDataRow[]> => {
      const database = await getDb();
      return await database.getAllAsync<ReportSensorDataRow>(
        `SELECT * FROM Report_Sensor_Data WHERE fieldId = ?`,
        [fieldId],
      );
    },

    delete: async (sensorDataId: number): Promise<void> => {
      const database = await getDb();
      await database.runAsync(
        `DELETE FROM Report_Sensor_Data WHERE sensorDataId = ?`,
        [sensorDataId],
      );
    },
  },

  // ── Report Media ──────────────────────────────────────────────────────────

  reportMedia: {
    save: async (media: ReportMediaRow): Promise<number> => {
      const database = await getDb();
      const result = await database.runAsync(
        `INSERT INTO Report_Media (fieldId, mediaType, mediaUrl, mediaGPS, mediaTimestamp, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          media.fieldId,
          media.mediaType ?? null,
          media.mediaUrl ?? null,
          media.mediaGPS ?? null,
          media.mediaTimestamp ?? null,
          now(),
          now(),
        ],
      );
      return result.lastInsertRowId;
    },

    getAllByFieldId: async (fieldId: number): Promise<ReportMediaRow[]> => {
      const database = await getDb();
      return await database.getAllAsync<ReportMediaRow>(
        `SELECT * FROM Report_Media WHERE fieldId = ?`,
        [fieldId],
      );
    },

    delete: async (mediaId: number): Promise<void> => {
      const database = await getDb();
      await database.runAsync(`DELETE FROM Report_Media WHERE mediaId = ?`, [
        mediaId,
      ]);
    },
  },
};
