// // whatsapp/entities/whatsapp-conversation.entity.ts
// import { Table, Column, Model, DataType } from 'sequelize-typescript';

// @Table({ tableName: 'whatsapp_conversations', timestamps: true })
// export class WhatsAppConversation extends Model {
//   @Column({ type: DataType.STRING, primaryKey: true })
//   phoneNumber: string;

//   @Column({ type: DataType.STRING })
//   step: 'ITEMS' | 'NAME' | 'INSTRUCTIONS';

//   @Column({ type: DataType.JSON })
//   selectedItems: Array<{ menuItemId: string; quantity: number }>;

//   @Column({ type: DataType.STRING })
//   customerName?: string;
// }
