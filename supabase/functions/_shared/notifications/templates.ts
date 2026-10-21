/**
 * Server notification templates use the same safe documents shown by the staff preview desk.
 * Recipient authorization and scoped unsubscribe tokens stay in the repository/worker boundary.
 * This approved shared boundary avoids a second set of mail copy in the frontend.
 */
export {
  isNotificationPayload, isNotificationReferenceId, renderNotificationTemplate,
  previewNotificationTemplate,
  type NotificationTemplate, type NotificationTemplateContext,
} from '../../../../packages/shared-types/notificationTemplates.ts';
