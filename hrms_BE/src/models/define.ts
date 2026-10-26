import { DataTypes, Model, ModelAttributes, ModelOptions, ModelStatic } from 'sequelize';
import { sequelize } from '../config/database';

/** Loosely-typed row: attributes are accessed dynamically (snake_case column names). */
export type Row = Model<any, any> & Record<string, any>;
export type HrModel = ModelStatic<Row>;

export const uuidPk = {
  type: DataTypes.UUID,
  defaultValue: DataTypes.UUIDV4,
  primaryKey: true,
  allowNull: false,
} as const;

export const tenantIdAttr = { type: DataTypes.UUID, allowNull: false } as const;

export function defineModel(
  name: string,
  tableName: string,
  attributes: ModelAttributes,
  options: ModelOptions = {},
): HrModel {
  return sequelize.define(
    name,
    { id: uuidPk, ...attributes },
    {
      tableName,
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      ...options,
    },
  ) as unknown as HrModel;
}

export { DataTypes };
