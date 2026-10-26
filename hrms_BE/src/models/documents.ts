import { DataTypes, defineModel, tenantIdAttr } from './define';
import { ACTIVE_STATUSES, DOCUMENT_STATUSES, REQUEST_STATUSES } from './constants';

export const DocumentTemplate = defineModel(
  'DocumentTemplate',
  'document_templates',
  {
    tenant_id: tenantIdAttr,
    name: { type: DataTypes.STRING(160), allowNull: false },
    code: { type: DataTypes.STRING(40), allowNull: false },
    body_template: { type: DataTypes.TEXT, allowNull: false },
    required_fields: { type: DataTypes.JSON, allowNull: false, defaultValue: [] },
    version: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'ACTIVE', validate: { isIn: [[...ACTIVE_STATUSES]] } },
  },
  { indexes: [{ unique: true, fields: ['tenant_id', 'code'] }] },
);

export const GeneratedDocument = defineModel(
  'GeneratedDocument',
  'generated_documents',
  {
    tenant_id: tenantIdAttr,
    template_id: { type: DataTypes.UUID, allowNull: false },
    employee_id: { type: DataTypes.UUID, allowNull: false },
    status: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'DRAFT', validate: { isIn: [[...DOCUMENT_STATUSES]] } },
    storage_path: { type: DataTypes.STRING(500), allowNull: true },
    version: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    generated_by: { type: DataTypes.UUID, allowNull: true },
    preview_payload: { type: DataTypes.JSON, allowNull: true },
    approved_by: { type: DataTypes.UUID, allowNull: true },
    issued_at: { type: DataTypes.DATE, allowNull: true },
  },
  { indexes: [{ fields: ['tenant_id', 'employee_id'] }, { fields: ['tenant_id', 'status'] }] },
);

export const ApprovalRequest = defineModel(
  'ApprovalRequest',
  'approval_requests',
  {
    tenant_id: tenantIdAttr,
    entity_type: { type: DataTypes.STRING(60), allowNull: false },
    entity_id: { type: DataTypes.UUID, allowNull: false },
    status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'PENDING', validate: { isIn: [[...REQUEST_STATUSES]] } },
    requester_id: { type: DataTypes.UUID, allowNull: true }, // user id
    current_step: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
  },
  { indexes: [{ fields: ['tenant_id', 'entity_type', 'entity_id'] }, { fields: ['tenant_id', 'status'] }] },
);

export const ApprovalStep = defineModel('ApprovalStep', 'approval_steps', {
  tenant_id: tenantIdAttr,
  approval_request_id: { type: DataTypes.UUID, allowNull: false },
  step_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
  approver_user_id: { type: DataTypes.UUID, allowNull: true },
  status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'PENDING', validate: { isIn: [[...REQUEST_STATUSES]] } },
  decided_at: { type: DataTypes.DATE, allowNull: true },
  note: { type: DataTypes.TEXT, allowNull: true },
});
