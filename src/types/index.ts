export interface User {
  id: string;
  email: string;
  slack_member_id: string | null;
  onboarding_complete: boolean;
  created_at: string;
}

export interface UserCredential {
  id: string;
  user_id: string;
  service: 'granola' | 'monday';
  encrypted_token: string;
  monday_workspace_id: string | null;
  monday_board_id: string | null;
  created_at: string;
}

export interface ProcessedNote {
  id: string;
  user_id: string;
  granola_note_id: string;
  processed_at: string;
}

export interface PendingActionItem {
  id: string;
  user_id: string;
  granola_note_id: string;
  action_item_text: string;
  slack_message_ts: string | null;
  status: 'pending' | 'approved' | 'denied' | 'failed';
  created_at: string;
}

// Attached to req by auth middleware
export interface AuthenticatedUser {
  id: string;
  email: string;
}
