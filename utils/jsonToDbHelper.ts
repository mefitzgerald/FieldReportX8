import { getDb } from "@/utils/sqliteHelper";

const DB_NAME = "fieldreportx.db";

export class JsonToDbHelper {
  async insertJsonToDb(userId: number, templateDoc: any) {
    if (!userId) {
      throw new Error("seedTemplateJsonForUser requires a valid userId.");
    }

    this.validateTemplateDocument(templateDoc);

    //db instance reinforce FK
    const db = await this.getDatabase();
    await db.execAsync("PRAGMA foreign_keys = ON;");

    //counters for return
    let processedTemplates = 0;
    let processedFields = 0;

    await db.withTransactionAsync(async () => {
      //get thge first template in the json (possible to add multiple at once later) default values are added if they doesn't exit to non crucial details
      const jsonTemplate = templateDoc.reportTemplates[0];
      const templateName = jsonTemplate.reportTemplateName.trim();
      const templateCategory = jsonTemplate.reportTemplateCategory.trim();
      const templateLayout = jsonTemplate.reportTemplateLayout ?? "portrait";
      const templateLayoutLogo = jsonTemplate.reportTemplateLayoutLogo ?? 0;
      const templateLayoutCompanyName =
        jsonTemplate.reportTemplateLayoutCompanyName ?? 0;
      const templateLayoutContactDetails =
        jsonTemplate.reportTemplateLayoutContactDetails ?? 0;
      //if there is no template verions default to version 1
      const templateVersion = jsonTemplate.reportTemplateVersion ?? 1;
      const templateShared = jsonTemplate.reportTemplateShared ?? 0;

      // Check if this template already exists by name + version
      const exists = await db.getFirstAsync<{ count: number }>(
        `SELECT COUNT(*) as count FROM Report_Template 
         WHERE userId = ? AND reportTemplateName = ? AND reportTemplateVersion = ?`,
        userId,
        templateName,
        templateVersion,
      );

      if (exists && exists.count > 0) {
        return; // Template already exists, skip insertion
      }

      // Insert template (let database auto-generate reportTemplateId)
      await db.runAsync(
        `
          INSERT INTO Report_Template (
            userId,
            reportTemplateName,
            reportTemplateCategory,
            reportTemplateLayout,
            reportTemplateLayoutLogo,
            reportTemplateLayoutCompanyName,
            reportTemplateLayoutContactDetails,
            reportTemplateFieldCount,
            reportTemplateVersion,
            reportTemplateShared
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        userId,
        templateName,
        templateCategory,
        templateLayout,
        templateLayoutLogo,
        templateLayoutCompanyName,
        templateLayoutContactDetails,
        jsonTemplate.reportTemplateFieldCount ??
          jsonTemplate.reportFieldTemplates?.length ??
          0,
        templateVersion,
        templateShared,
      );
      console.log(
        `Inserted template "${templateName}" version ${templateVersion} for user ID ${userId}`,
      );
      processedTemplates = 1;

      // Get the inserted template ID so it can be added to the tempatye fields
      const insertedTemplate = await db.getFirstAsync<{
        reportTemplateId: number;
      }>(
        `SELECT reportTemplateId FROM Report_Template 
         WHERE userId = ? AND reportTemplateName = ? AND reportTemplateVersion = ?`,
        userId,
        templateName,
        templateVersion,
      );

      //just in case- really shouldn;t happen
      if (!insertedTemplate) {
        throw new Error(
          `Failed to retrieve inserted template for ${jsonTemplate.reportTemplateName}`,
        );
      }

      //internal db template id
      const templateId = insertedTemplate.reportTemplateId;

      // Insert fields
      //get the field templates in an array or just an empty array.
      const fields = jsonTemplate.reportFieldTemplates ?? [];

      //loop through form fields and insert them with the template id as FK
      for (const [index, field] of fields.entries()) {
        //if theres no field order numbers use array index + 1
        // as the order (so they default to the order in the json) I probably should have
        //done this from the get go. lesson learned.
        const order = field.fieldOrderNumber ?? index + 1;

        await db.runAsync(
          `
            INSERT INTO Report_Field_Templates (
              reportTemplateId,
              fieldTemplateLabel,
              fieldTemplateType,
              fieldTemplateRequired,
              fieldOrderNumber
            )
            VALUES (?, ?, ?, ?, ?)
          `,
          templateId,
          field.fieldTemplateLabel,
          field.fieldTemplateType,
          field.fieldTemplateRequired ?? 0,
          order,
        );

        processedFields += 1;
        console.log(
          `Inserted field "${field.fieldTemplateLabel}" of type "${field.fieldTemplateType}" for template ID ${templateId} (user ID ${userId})`,
        );
      }
    });
    return {
      processedTemplates,
      processedFields,
    };
  }

  private async getDatabase() {
    return await getDb();
  }

  //check all the required fields are complete and in the right format, throw an error if not
  private validateTemplateDocument(templateDoc: any) {
    if (!templateDoc || !Array.isArray(templateDoc.reportTemplates)) {
      throw new Error("Template JSON must include reportTemplates[]");
    }

    if (templateDoc.reportTemplates.length === 0) {
      throw new Error("Template JSON must include one report template");
    }

    const template = templateDoc.reportTemplates[0];

    if (!template || !template.reportTemplateName?.trim()) {
      throw new Error("Template is missing reportTemplateName");
    }

    if (!template.reportTemplateCategory?.trim()) {
      throw new Error("Template is missing reportTemplateCategory");
    }

    if (
      template.reportFieldTemplates &&
      !Array.isArray(template.reportFieldTemplates)
    ) {
      throw new Error("Template has invalid reportFieldTemplates");
    }

    for (const [fieldIndex, field] of (
      template.reportFieldTemplates ?? []
    ).entries()) {
      if (!field?.fieldTemplateLabel?.trim()) {
        throw new Error(
          `Field at index ${fieldIndex} is missing fieldTemplateLabel`,
        );
      }

      if (!field?.fieldTemplateType?.trim()) {
        throw new Error(
          `Field at index ${fieldIndex} is missing fieldTemplateType`,
        );
      }
    }
  }
}

export const jsonToDbHelper = new JsonToDbHelper();
