// import { Table, Column, Model, DataType } from 'sequelize-typescript';

// @Table({ tableName: 'whatsapp_settings', timestamps: true })
// export class WhatsAppSettings extends Model {
//   @Column({
//     type: DataType.UUID,
//     defaultValue: DataType.UUIDV4,
//     primaryKey: true,
//   })
//   declare id: string;

//   @Column({ type: DataType.STRING, allowNull: false })
//   declare phoneNumber: string;

//   @Column({ type: DataType.TEXT, allowNull: false })
//   declare welcomeMessage: string;

//   @Column({ type: DataType.BOOLEAN, defaultValue: true })
//   declare isActive: boolean;

//   @Column({ type: DataType.STRING })
//   declare apiKey: string;

//   @Column({ type: DataType.JSON })
//   declare messageTemplates: any;

//   @Column({ type: DataType.DATE })
//   declare lastConnectionTest: Date;

//   @Column({ type: DataType.STRING })
//   declare connectionStatus: string;
// }
