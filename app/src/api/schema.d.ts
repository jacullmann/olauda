// Generated from server/openapi.json by scripts/generate-api-types.mjs.
// Do not edit; run `pnpm api:types` after changing the API.

export interface paths {
    "/groups/{group_id}/announcements": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                group_id: string;
            };
            cookie?: never;
        };
        /**
         * The group's announcements, newest first, each with whether the member
         *     read it.
         */
        get: operations["list_announcements"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/groups/{group_id}/announcements/read": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                group_id: string;
            };
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["mark_announcements_read"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/groups/{group_id}/admin/announcements": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                group_id: string;
            };
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["create_announcement"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/groups/{group_id}/admin/announcements/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                group_id: string;
            };
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete: operations["delete_announcement"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/groups/{group_id}": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                group_id: string;
            };
            cookie?: never;
        };
        get: operations["get_group"];
        put?: never;
        post?: never;
        delete: operations["delete_group"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/groups/{group_id}/visit": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                group_id: string;
            };
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Remembers the group as where the app opens next time. */
        post: operations["record_visit"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/groups/{group_id}/leave": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                group_id: string;
            };
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete: operations["leave_group"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/groups/{group_id}/members": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                group_id: string;
            };
            cookie?: never;
        };
        /**
         * Every member may see who else is in the group; only the pseudonyms are
         *     exposed, never emails.
         */
        get: operations["get_members"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/groups/{group_id}/invites": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                group_id: string;
            };
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["create_invite"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/groups/{group_id}/admin/banned-users": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                group_id: string;
            };
            cookie?: never;
        };
        get: operations["get_banned_users"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/groups/{group_id}/admin/banned-users/{user_id}": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                group_id: string;
            };
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete: operations["revert_ban"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/groups/{group_id}/admin/invites": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                group_id: string;
            };
            cookie?: never;
        };
        get: operations["get_invites"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/groups/{group_id}/admin/invites/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                group_id: string;
            };
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete: operations["revoke_invite"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/groups/{group_id}/admin/members/{user_id}/role": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                group_id: string;
            };
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch: operations["change_member_role"];
        trace?: never;
    };
    "/groups/{group_id}/admin/members/{user_id}/mute": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                group_id: string;
            };
            cookie?: never;
        };
        get?: never;
        put: operations["mute_member"];
        post?: never;
        delete: operations["unmute_member"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/groups/{group_id}/admin/members/{user_id}": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                group_id: string;
            };
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete: operations["remove_member"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/groups/{group_id}/admin/transfer-ownership": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                group_id: string;
            };
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** The previous owner stays in the group as an admin. */
        post: operations["transfer_ownership"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/groups/{group_id}/admin/settings": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                group_id: string;
            };
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /**
         * The group's profile (name, picture) and configuration (type, Dalton) need
         *     separate permissions.
         */
        patch: operations["update_group_settings"];
        trace?: never;
    };
    "/groups/{group_id}/admin/permissions": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                group_id: string;
            };
            cookie?: never;
        };
        get: operations["get_permissions"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch: operations["update_permissions"];
        trace?: never;
    };
    "/groups/{group_id}/admin/subjects": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                group_id: string;
            };
            cookie?: never;
        };
        get: operations["get_subjects_admin"];
        put?: never;
        post: operations["create_subject"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/groups/{group_id}/admin/subjects/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                group_id: string;
            };
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** Tasks of the subject keep its name as a hand-typed one. */
        delete: operations["delete_subject"];
        options?: never;
        head?: never;
        patch: operations["update_subject"];
        trace?: never;
    };
    "/groups/{group_id}/admin/subjects/{subject_id}/courses": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                group_id: string;
            };
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["create_course"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/groups/{group_id}/admin/courses/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                group_id: string;
            };
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete: operations["delete_course"];
        options?: never;
        head?: never;
        patch: operations["update_course"];
        trace?: never;
    };
    "/groups/{group_id}/admin/schedule": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                group_id: string;
            };
            cookie?: never;
        };
        /**
         * The whole timetable without personalization. Readable by every member,
         *     like `/schedule`.
         */
        get: operations["get_schedule_admin"];
        /** Replaces the timetable and the layout of the school day at once. */
        put: operations["replace_schedule_admin"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/groups/{group_id}/admin/schedule/subs": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                group_id: string;
            };
            cookie?: never;
        };
        /** Readable by every member, like `/schedule/subs`. */
        get: operations["get_schedule_subs_admin"];
        put: operations["save_schedule_sub"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/groups/{group_id}/admin/schedule/subs/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                group_id: string;
            };
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete: operations["delete_schedule_sub"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/groups/{group_id}/items": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                group_id: string;
            };
            cookie?: never;
        };
        /** The group's tasks for the given filters, ordered by due date. */
        get: operations["get_items"];
        put?: never;
        /**
         * Refused with `DUPLICATE_ITEM` while a task of the same type, subject and
         *     day exists, unless `confirmDuplicate` is set.
         */
        post: operations["create_item"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/groups/{group_id}/items/reports": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                group_id: string;
            };
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["report_item"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/groups/{group_id}/items/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                group_id: string;
            };
            cookie?: never;
        };
        get: operations["get_item_by_id"];
        put?: never;
        post?: never;
        delete: operations["delete_item"];
        options?: never;
        head?: never;
        patch: operations["update_item"];
        trace?: never;
    };
    "/groups/{group_id}/items/{id}/note": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                group_id: string;
            };
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch: operations["update_item_note"];
        trace?: never;
    };
    "/groups/{group_id}/items/{id}/attachments": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                group_id: string;
            };
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["add_attachment"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/groups/{group_id}/items/{id}/attachments/{attachment_id}": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                group_id: string;
            };
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete: operations["remove_attachment"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/groups/{group_id}/schedule": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                group_id: string;
            };
            cookie?: never;
        };
        /** The timetable as the member sees it. */
        get: operations["get_schedule"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/groups/{group_id}/schedule/subs": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                group_id: string;
            };
            cookie?: never;
        };
        get: operations["get_subs"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/groups/{group_id}/schedule/subjects": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                group_id: string;
            };
            cookie?: never;
        };
        get: operations["get_subjects"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/groups/{group_id}/me/courses": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                group_id: string;
            };
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** Clears the member's courses in this group and asks for them again. */
        delete: operations["reset_setup"];
        options?: never;
        head?: never;
        /** Replaces the member's course selection in this group. */
        patch: operations["update_setup"];
        trace?: never;
    };
    "/groups/{group_id}/items/{id}/visibility": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                group_id: string;
            };
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["set_visibility"];
        delete: operations["remove_visibility"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/groups/{group_id}/items/{id}/check": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                group_id: string;
            };
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["check_item"];
        delete: operations["uncheck_item"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/groups/{group_id}/items/{id}/pin": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                group_id: string;
            };
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["pin_item"];
        delete: operations["unpin_item"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/system/status": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Liveness check for the deployment. */
        get: operations["health"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/system/csrf/init": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Sets the cookie whose value every changing request repeats in the
         *     `x-csrf-token` header.
         */
        get: operations["csrf_init"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/system/access": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Whether sign-ups are open and the platform is running, for the sign-in
         *     and sign-up pages.
         */
        get: operations["get_access_status"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/system-announcements": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** The running announcements the user has yet to read, newest first. */
        get: operations["list_system_announcements"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/system-announcements/read": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["mark_system_announcements_read"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/mfa/verify": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["verify_mfa"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/mfa/passkey/challenge": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["start_mfa_passkey"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/mfa/passkey/verify": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["verify_mfa_passkey"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/register": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Stores the sign-up and mails its confirmation code. */
        post: operations["register"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/verify/resend": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Answers the same whether or not a code was sent, so it reveals nothing
         *     about the address.
         */
        post: operations["resend_verification"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/forgot": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Answers the same whether or not the address has an account. */
        post: operations["forgot_password"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/login": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Signs in with email and password. An account with two-factor
         *     authentication gets a pending sign-in instead of a session.
         */
        post: operations["login"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/verify": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Entering the emailed code with the password chosen at sign-up creates the
         *     account and signs it in.
         */
        post: operations["confirm_sign_up"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/reset/verify": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Trades the emailed code for the token that sets the new password. */
        post: operations["verify_reset_token"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/reset": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["reset_password"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/set-password/code": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Mails the code that lets a passwordless account set its first password. */
        post: operations["request_password_setup_code"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/set-password": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["set_password"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/mfa/challenge": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Tells the sign-in page whether to offer a passkey besides the code. Only
         *     whoever already passed the first factor can ask.
         */
        get: operations["get_mfa_challenge"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/mfa/cancel": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["cancel_mfa"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/me": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** The signed-in user, or `null` without a session. */
        get: operations["get_me"];
        put?: never;
        post?: never;
        delete: operations["delete_me"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/change-password": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Every other session ends; this one continues with new tokens. */
        post: operations["change_password"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/password": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete: operations["remove_password"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/sign-in-methods": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["get_sign_in_methods"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/refresh": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Rotates the session's tokens, which share one cookie across tabs. */
        post: operations["refresh"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/logout": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["logout"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/logout-all": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["logout_all"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/logout-others": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["logout_all_others"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/sessions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["list_sessions"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/sessions/{family_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete: operations["revoke_session"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/user/personalization": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch: operations["update_personalization"];
        trace?: never;
    };
    "/user/preferences": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /** Saves the named settings and keeps the others. */
        patch: operations["update_preferences"];
        trace?: never;
    };
    "/user/dismissed-notices/{notice}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put: operations["dismiss_notice"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/user/checks": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** The tasks the user checked off, in every group. */
        get: operations["get_checks"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/user/pins": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** The tasks the user pinned, in every group. */
        get: operations["get_pins"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/user/visibility": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** The tasks the user moved into or kept out of the archive, in every group. */
        get: operations["get_visibility"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/user/activity/pageload": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["log_page_load"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/user/data-export": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * A ZIP of everything stored about the account. It needs a recent sign-in,
         *     as a stolen session must not be enough to take it.
         */
        get: operations["export_data"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/groups": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["create_group"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/groups/status": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * The caller's groups and where the app opens; answers signed-out callers
         *     too, which is how the client learns whether a session exists.
         */
        get: operations["get_groups_status"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/invites/{token}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** What an invite link leads to; signing in is optional. */
        get: operations["get_invite"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/invites/{token}/accept": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["accept_invite"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/todos": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** The user's private tasks in their order. */
        get: operations["get_todos"];
        put?: never;
        /** Adds a private task at the top of the list. */
        post: operations["create_todo"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/todos/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put: operations["update_todo"];
        post?: never;
        delete: operations["delete_todo"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/todos/{id}/toggle": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch: operations["toggle_todo"];
        trace?: never;
    };
    "/todos/{id}/reorder": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch: operations["reorder_todo"];
        trace?: never;
    };
    "/mfa/activate": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Only a secret from a recent `setup` can be activated, which already
         *     required a recent sign-in.
         */
        post: operations["activate"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/mfa/deactivate": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["deactivate"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/mfa/recovery-codes": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["regenerate_recovery_codes"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/mfa/status": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["get_mfa_status"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/mfa/setup": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Shows a new secret, so it needs a recent sign-in: otherwise a stolen
         *     session could tie the account to the thief's authenticator.
         */
        post: operations["setup"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/google": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Sends the browser to Google to sign in. */
        get: operations["initiate_google_oauth"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/google/signup": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Finishes a Google sign-up the callback could not complete on its own: the
         *     user has to accept the terms before an account is created.
         */
        post: operations["sign_up_with_google"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/google/callback": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Where Google sends the browser back; it always redirects into the app,
         *     with the outcome in the query.
         */
        get: operations["handle_google_callback"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/google/link/start": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * A POST rather than a navigation: it needs the CSRF check and lets the
         *     client refresh an expired access token before the flow starts. A linked
         *     Google account is a lasting way in, so it needs a recent sign-in.
         */
        post: operations["start_google_link"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/google/unlink": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete: operations["unlink_google_account"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/providers": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["get_linked_providers"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/passkey/challenge": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Starts a sign-in with any passkey the browser holds for this site. */
        post: operations["start_sign_in"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/passkey/verify": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["finish_sign_in"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/passkeys/registration/start": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * A new passkey is a lasting way in, so adding one needs a recent sign-in:
         *     otherwise a stolen session could outlive its own revocation. Finishing only
         *     redeems the registration started here.
         */
        post: operations["start_registration"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/passkeys/registration/finish": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["finish_registration"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/passkeys": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["list_passkeys"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/passkeys/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete: operations["remove_passkey"];
        options?: never;
        head?: never;
        patch: operations["rename_passkey"];
        trace?: never;
    };
    "/auth/reauth": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * How the user can confirm who they are, and until when a confirmation
         *     still counts.
         */
        get: operations["get_reauth_status"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/reauth/password": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["confirm_with_password"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/reauth/passkey/start": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["start_passkey"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/reauth/passkey/finish": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["confirm_with_passkey"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/reauth/google/start": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * A POST rather than a navigation, like linking Google: it needs the CSRF
         *     check and lets the client refresh an expired access token first.
         */
        post: operations["start_google"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/reauth/google/second-factor": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["confirm_google_second_factor"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/admin/stats": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["get_stats"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/admin/stats/daily": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["get_daily_activity"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/admin/stats/weekly-rhythm": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["get_weekly_rhythm"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/admin/stats/account-security": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["get_account_security"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/admin/server-metrics": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["get_server_metrics"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/admin/emails/activity": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["get_email_activity"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/admin/emails/quota": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["get_email_quota"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/admin/cleanup-jobs": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["get_cleanup_jobs"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/admin/events": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** The security and activity logs, newest or oldest first, a page at a time. */
        get: operations["get_events"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/admin/groups": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["list_admin_groups"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/admin/groups/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["get_admin_group"];
        put?: never;
        post?: never;
        delete: operations["delete_admin_group"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/admin/groups/{id}/ban": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Only superadmins can open a banned group; its invites admit nobody. */
        post: operations["ban_group"];
        delete: operations["unban_group"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/admin/users": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["list_admin_users"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/admin/users/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["get_admin_user"];
        put?: never;
        post?: never;
        delete: operations["delete_admin_user"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/admin/users/{id}/groups": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["get_user_memberships"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/admin/users/{id}/groups/{group_id}/role": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /** Picking "owner" hands the group over; the previous owner stays as admin. */
        patch: operations["change_membership_role"];
        trace?: never;
    };
    "/admin/users/{id}/ban": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Ends every session of the user at once. */
        post: operations["ban_user"];
        delete: operations["unban_user"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/admin/users/{id}/mfa": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete: operations["reset_user_mfa"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/admin/reports": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Reports, newest first, each with a snapshot of the reported task. */
        get: operations["get_reports"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/admin/reports/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete: operations["delete_report"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/admin/system-announcements": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Running and scheduled announcements, latest start first. */
        get: operations["list_admin_system_announcements"];
        put?: never;
        post: operations["create_system_announcement"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/admin/system-announcements/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /** Only scheduled announcements can be changed. */
        put: operations["update_system_announcement"];
        post?: never;
        delete: operations["delete_system_announcement"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/admin/access-controls": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["get_access_controls"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch: operations["update_access_controls"];
        trace?: never;
    };
    "/groups/{group_id}/items/uploads": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                group_id: string;
            };
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Stores a file for a task; it is attached by sending its id along with the
         *     task or to the task's attachments.
         */
        post: operations["upload_attachment"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/uploads/group-avatar": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * A new group's picture is uploaded before the group exists, so this is the
         *     one upload that needs no group membership.
         */
        post: operations["upload_group_avatar"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/events": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * The signed-in user's live updates as server-sent events. The stream ends
         *     when the access token expires, so a revoked session or membership cannot
         *     outlive it; the browser then reconnects with a fresh token.
         */
        get: operations["events"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        /**
         * @description The switches as stored and as superadmins manage them. Shutdown closes
         *     sign-ups without touching `registration_paused`, so ending it restores
         *     what sign-ups were set to.
         */
        AccessControls: {
            registrationPaused: boolean;
            shutdown: boolean;
        };
        /** @description What the sign-in and sign-up pages need to know before anyone signs in. */
        AccessStatusDto: {
            registrationOpen: boolean;
            shutdown: boolean;
        };
        /**
         * @description How every account, superadmins included, is secured and signs in. Each
         *     breakdown splits all accounts into disjoint parts that add up to the total.
         */
        AccountSecurityDto: {
            secondFactor: components["schemas"]["SecondFactorBreakdown"];
            google: components["schemas"]["GoogleBreakdown"];
        };
        /**
         * @description A part of the recipient's own account.
         * @enum {string}
         */
        AccountTopic: "groups" | "todos" | "profile" | "security";
        AddAttachmentDto: {
            /** Format: uuid */
            assetId: string;
        };
        AdminGroupDto: {
            /** Format: uuid */
            id: string;
            name: string;
            avatarUrl?: string | null;
            groupType: components["schemas"]["GroupType"];
            /** Format: uuid */
            ownerId: string;
            ownerEmail: string;
            ownerName: string;
            /** Format: date-time */
            createdAt: string;
            /**
             * Format: date-time
             * @description Set while the group is banned.
             */
            bannedAt?: string | null;
            /** Format: int64 */
            memberCount: number;
            /** Format: int64 */
            itemCount: number;
        };
        /**
         * @description An announcement as superadmins manage it. Ended ones are never listed:
         *     they are gone for everyone, and the cleanup deletes them.
         */
        AdminSystemAnnouncementDto: {
            /** Format: uuid */
            id: string;
            content: string;
            important: boolean;
            status: components["schemas"]["SystemAnnouncementStatus"];
            /** Format: date-time */
            startsAt: string;
            /** Format: date-time */
            endsAt?: string | null;
            authorEmail?: string | null;
            /** Format: int64 */
            readCount: number;
        };
        AdminUserDto: {
            /** Format: uuid */
            id: string;
            email: string;
            username: string;
            mfaEnabled: boolean;
            isSuperadmin: boolean;
            isBanned: boolean;
            /** Format: date-time */
            createdAt: string;
            /** Format: date-time */
            lastLoginAt?: string | null;
        };
        /** @description An announcement as one member sees it. */
        AnnouncementDto: {
            /** Format: uuid */
            id: string;
            content: string;
            important: boolean;
            /** Format: uuid */
            createdBy?: string | null;
            /** Format: date-time */
            createdAt: string;
            read: boolean;
        };
        /**
         * @description When checked tasks leave the list for the archive. The task list query
         *     reads the stored names, so they must not change.
         * @enum {string}
         */
        ArchiveCheckedTasks: "always" | "afterDueDate" | "never";
        AttachmentDto: components["schemas"]["FileDto"] & {
            /** Format: uuid */
            id: string;
            /**
             * Format: uuid
             * @description Recorded by the server; lets the uploader remove their file again from
             *     a task they do not own.
             */
            createdBy?: string | null;
        };
        BannedMemberDto: {
            /** Format: uuid */
            userId: string;
            generatedName: string;
            /** Format: date-time */
            bannedAt: string;
        };
        ChangeMemberRoleDto: {
            role: components["schemas"]["Role"];
        };
        ChangeMembershipRoleDto: {
            role: components["schemas"]["MemberRole"];
        };
        ChangePasswordDto: {
            currentPassword: string;
            newPassword: string;
        };
        /**
         * @description A pg_cron cleanup (or the asset worker), named as scheduled, with the rows
         *     it should already have removed. Anything above zero means it is not running.
         */
        CleanupJobDto: {
            job: string;
            /** Format: int64 */
            overdueCount: number;
        };
        ConfirmSignUpDto: {
            email: string;
            code: components["schemas"]["EmailCode"];
            password: string;
        };
        CourseDto: {
            /** Format: uuid */
            id: string;
            name: string;
            courseType?: components["schemas"]["CourseType"] | null;
        };
        /** @description A course the user takes, with the subject it belongs to. */
        CourseSelectionDto: {
            /** Format: uuid */
            subjectId: string;
            /** Format: uuid */
            courseId: string;
        };
        /**
         * @description Where the caller stands with picking their courses in a group.
         * @enum {string}
         */
        CourseSetup: "done" | "pending" | "not_needed";
        /**
         * @description The level of an Abitur course; regular groups have none.
         * @enum {string}
         */
        CourseType: "gk" | "lk" | "zk";
        CreateAnnouncementDto: {
            content: string;
            important?: boolean;
        };
        CreateCourseDto: {
            name: string;
            courseType?: components["schemas"]["CourseType"] | null;
        };
        CreateGroupDto: {
            groupName: string;
            /**
             * Format: uuid
             * @description An upload from `/uploads/group-avatar`.
             */
            avatarId?: string | null;
            groupType?: components["schemas"]["GroupType"];
            daltonEnabled?: boolean;
        };
        CreateItemDto: {
            type: components["schemas"]["ItemType"];
            title: string;
            subject: components["schemas"]["ItemSubjectDto"];
            description?: string | null;
            /** @description Uploads of the creator to attach, in display order. */
            attachmentIds?: string[];
            /** Format: date-time */
            dueDate: string;
            /** @description Creates the task even though one for the same subject and day exists. */
            confirmDuplicate?: boolean;
        };
        CreateSubjectDto: {
            name: string;
            category?: components["schemas"]["SubjectCategory"] | null;
            isDalton?: boolean;
        };
        /** @description The answer to creating something, which the client refers to it by. */
        CreatedDto: {
            /** Format: uuid */
            id: string;
        };
        CurrentUserDto: {
            /** Format: uuid */
            id: string;
            email: string;
            /** @description `superadmin` or `user`; group roles come with each group. */
            role: components["schemas"]["Role"];
            /** @description The courses the user takes, in every group. */
            courses: components["schemas"]["CourseSelectionDto"][];
            personalized: boolean;
            mfaEnabled: boolean;
            /** @description Google-only accounts have no password until they set one. */
            hasPassword: boolean;
            preferences: components["schemas"]["PreferencesDto"];
            /** @description The user's pseudonym, the same in every group. */
            username: string;
        };
        DailyActivityDto: {
            /** Format: date */
            day: string;
            /** Format: int64 */
            newUsers: number;
            /** Format: int64 */
            newGroups: number;
            /** Format: int64 */
            newItems: number;
            /** Format: int64 */
            appOpens: number;
            /** Format: int64 */
            activeUsers: number;
            /** Format: int64 */
            failedLogins: number;
        };
        DailyEmailsDto: {
            /** Format: date */
            day: string;
            /** Format: u-int64 */
            sent: number;
        };
        DashboardPreferencesDto: {
            tagline?: boolean | null;
        };
        /**
         * Format: binary
         * @description The ZIP the export downloads as.
         */
        DataArchive: Blob;
        /**
         * @description Hints a user can hide for good. Each page keeps its own entry, so hiding a
         *     hint on one page leaves it in place on the others.
         * @enum {string}
         */
        DismissibleNotice: "personalizedTasks" | "personalizedSchedule" | "privateTasks";
        EditorNoteDto: {
            editorNote: string;
        };
        /**
         * @description The emails Resend sent per day and what became of them, over the same days
         *     as the daily activity.
         */
        EmailActivityDto: {
            days: components["schemas"]["DailyEmailsDto"][];
            /** Format: u-int64 */
            delivered: number;
            /** Format: u-int64 */
            bounced: number;
            /** Format: u-int64 */
            failed: number;
        };
        /**
         * @description A code as we mail it: six digits, quick to read off a phone and type on
         *     another device. Anything else is rejected before it can cost a guess.
         */
        EmailCode: string;
        /** @description Emails used in the current billing month of the Resend plan. */
        EmailQuotaDto: {
            /** Format: u-int32 */
            used: number;
            /**
             * Format: u-int32
             * @description Absent on plans without a monthly limit.
             */
            limit?: number | null;
            resetsAt: string;
        };
        /**
         * @description The body of every error response. `error` is English and meant for
         *     debugging; clients explain a failure by its `code`.
         */
        ErrorBody: {
            error: string;
            code?: components["schemas"]["ErrorCode"] | null;
            /**
             * Format: int64
             * @description Seconds until a refused action may be tried again.
             */
            retryAfter?: number | null;
            /**
             * Format: uuid
             * @description The group a ban or mute applies to, so a client with several groups
             *     open knows which one is affected.
             */
            groupId?: string | null;
            /** Format: u-int64 */
            maxBytes?: number | null;
            /** @description The fields that failed validation. */
            fields?: string[] | null;
            duplicate?: components["schemas"]["ItemDto"] | null;
        };
        /**
         * @description Every reason a client may tell apart and act on.
         * @enum {string}
         */
        ErrorCode: "AUTH_REQUIRED" | "MFA_CHALLENGE_EXPIRED" | "LOGIN_LOCKED" | "MFA_LOCKED" | "EMAIL_CODE_THROTTLED" | "PASSKEY_CHALLENGE_EXPIRED" | "PASSKEY_UNKNOWN" | "PASSKEY_REJECTED" | "PASSKEY_REGISTRATION_REJECTED" | "PASSKEY_ALREADY_REGISTERED" | "PASSKEY_LIMIT_REACHED" | "INVALID_CREDENTIALS" | "INCORRECT_PASSWORD" | "EMAIL_ALREADY_REGISTERED" | "EMAIL_NOT_VERIFIED" | "SECOND_FACTOR_REQUIRED" | "INVALID_SECOND_FACTOR" | "LAST_SIGN_IN_METHOD" | "REAUTH_REQUIRED" | "REAUTH_LOCKED" | "REGISTRATION_PAUSED" | "SHUTDOWN" | "BANNED_FROM_GROUP" | "GROUP_BANNED" | "MUTED_IN_GROUP" | "FILE_TOO_LARGE" | "UNSUPPORTED_FILE" | "DUPLICATE_ITEM" | "NAME_TAKEN" | "RATE_LIMITED" | "RESEND_NOT_CONFIGURED" | "RESEND_KEY_REJECTED" | "RESEND_UNREACHABLE" | "HETZNER_TOKEN_REJECTED" | "HETZNER_SERVER_NOT_FOUND" | "HETZNER_UNREACHABLE";
        /**
         * @description What changed. Events carry no content: a client reloads what shows the
         *     change through the regular endpoints, which authorize every read, so an
         *     event can never reveal more than its recipient may see anyway.
         */
        Event: {
            /** Format: uuid */
            groupId: string;
            topic: components["schemas"]["GroupTopic"];
            /** @enum {string} */
            scope: "group";
        } | {
            topic: components["schemas"]["AccountTopic"];
            /** @enum {string} */
            scope: "account";
        } | {
            topic: components["schemas"]["PlatformTopic"];
            /** @enum {string} */
            scope: "platform";
        } | {
            /** @enum {string} */
            scope: "resync";
        };
        /**
         * @description An entry of either log with the names of the accounts and group it refers
         *     to, as far as they still exist: security events outlive them.
         */
        EventLogEntryDto: {
            /** Format: uuid */
            id: string;
            source: components["schemas"]["EventSource"];
            type: string;
            outcome?: components["schemas"]["Outcome"] | null;
            /** Format: uuid */
            userId?: string | null;
            userEmail?: string | null;
            /** Format: uuid */
            actorId?: string | null;
            actorEmail?: string | null;
            /** Format: uuid */
            groupId?: string | null;
            groupName?: string | null;
            ipAddress?: string | null;
            userAgent?: string | null;
            metadata: {
                [key: string]: unknown;
            };
            /** Format: date-time */
            createdAt: string;
        };
        EventLogPage: {
            items: components["schemas"]["EventLogEntryDto"][];
            /** @description Absent once the log is exhausted. */
            nextCursor?: string | null;
            /**
             * Format: int64
             * @description How many entries match in all, counted for the first page only, so
             *     scrolling further costs no count of the whole log.
             */
            total?: number | null;
        };
        /**
         * @description Which log an entry comes from: the security audit log or the activity log.
         * @enum {string}
         */
        EventSource: "security" | "activity";
        /** @description What clients need to display a stored file and build its delivery URLs. */
        FileDto: {
            publicId: string;
            resourceType: components["schemas"]["ResourceType"];
            format: string;
            /** Format: int32 */
            width?: number | null;
            /** Format: int32 */
            height?: number | null;
            name?: string | null;
            thumbnailPublicId?: string | null;
        };
        FinishRegistrationDto: {
            name: string;
            credential: unknown;
        };
        ForgotPasswordDto: {
            email: string;
        };
        /** @description Where the browser goes to continue with Google. */
        GoogleAuthUrlDto: {
            url: string;
        };
        GoogleBreakdown: {
            /** Format: int64 */
            notLinked: number;
            /**
             * Format: int64
             * @description Google linked next to a password.
             */
            linked: number;
            /**
             * Format: int64
             * @description No password: the account signs in with Google or a passkey only.
             */
            googleOnly: number;
        };
        GoogleSignUpDto: {
            acceptedTerms: boolean;
        };
        GroupAvatarUploadDto: {
            /** Format: uuid */
            id: string;
            url: string;
        };
        /**
         * @description An invite as moderators review it. The token is only handed out while the
         *     invite can still be used.
         */
        GroupInviteDto: {
            /** Format: uuid */
            id: string;
            token?: string | null;
            /** Format: uuid */
            createdBy?: string | null;
            createdByName?: string | null;
            /** Format: date-time */
            createdAt: string;
            /** Format: date-time */
            expiresAt: string;
            /** Format: date-time */
            usedAt?: string | null;
            /** Format: uuid */
            usedBy?: string | null;
            usedByName?: string | null;
            /** Format: date-time */
            revokedAt?: string | null;
            /** Format: uuid */
            revokedBy?: string | null;
            revokedByName?: string | null;
        };
        GroupMemberDto: {
            /** Format: uuid */
            userId: string;
            generatedName: string;
            role: components["schemas"]["MemberRole"];
            /** Format: date-time */
            joinedAt: string;
            /** @description What the requesting user may change this member's role to. */
            assignableRoles: components["schemas"]["MemberRole"][];
            /** @description Whether the requesting user may remove this member. */
            canRemove: boolean;
            /**
             * @description Left out unless the requesting user may mute this member: a mute is
             *     between the member and the group's moderators.
             */
            muted?: boolean | null;
            /** @description Whether the requesting user may mute or unmute this member. */
            canMute: boolean;
        };
        /** @description The lowest role each permission requires. */
        GroupPermissions: {
            edit_group_profile: components["schemas"]["Role"];
            edit_subjects_courses: components["schemas"]["Role"];
            edit_schedule: components["schemas"]["Role"];
            create_items: components["schemas"]["Role"];
            upload_images: components["schemas"]["Role"];
            manage_notes: components["schemas"]["Role"];
            manage_schedule_changes: components["schemas"]["Role"];
            manage_announcements: components["schemas"]["Role"];
            moderate_members: components["schemas"]["Role"];
            edit_other_content: components["schemas"]["Role"];
            delete_other_content: components["schemas"]["Role"];
            invite_members: components["schemas"]["Role"];
        };
        GroupStatusDto: {
            authenticated: boolean;
            groups: components["schemas"]["GroupSummaryDto"][];
            /**
             * Format: uuid
             * @description Where the app opens after sign-in; never used to scope a request.
             */
            landingGroupId?: string | null;
        };
        /**
         * @description A group as the client sees it, including what the caller may do in it, so
         *     the UI never has to re-derive permissions from the raw matrix.
         */
        GroupSummaryDto: {
            /** Format: uuid */
            id: string;
            name: string;
            /** Format: uuid */
            ownerId: string;
            role: components["schemas"]["Role"];
            scheduleConfig: components["schemas"]["ScheduleConfigDto"];
            avatarUrl?: string | null;
            /** @description Resolved against the defaults, so clients never need to know them. */
            permissions: components["schemas"]["GroupPermissions"];
            groupType: components["schemas"]["GroupType"];
            daltonEnabled: boolean;
            effectivePermissions: components["schemas"]["Permission"][];
            courseSetup: components["schemas"]["CourseSetup"];
            /** @description A superadmin banned the group: only superadmins can still open it. */
            banned: boolean;
            /** @description The caller may read the group but not change anything in it. */
            muted: boolean;
        };
        /**
         * @description A part of one group.
         * @enum {string}
         */
        GroupTopic: "tasks" | "announcements" | "schedule" | "subjects" | "members" | "settings" | "taskMarks" | "courses";
        /**
         * @description How a group organises its subjects and its schedule.
         *
         *     A regular group is one class that attends every lesson together. An Abitur
         *     group is a whole year in which nearly every lesson belongs to a single
         *     course, so lessons are scheduled per course instead of per subject.
         * @enum {string}
         */
        GroupType: "regular" | "abitur";
        HealthDto: {
            status: string;
            /** Format: date-time */
            timestamp: string;
        };
        InviteAcceptedDto: {
            /** Format: uuid */
            groupId: string;
            /** @description The user was a member before; the invite stays unused. */
            alreadyMember: boolean;
        };
        InviteCreatedDto: {
            /** @description The secret the invite link carries. */
            token: string;
        };
        /**
         * @description What an invite link shows before joining. The group's id is only revealed
         *     to members, so the preview stays anonymous for everyone else.
         */
        InvitePreviewDto: {
            groupName: string;
            avatarUrl?: string | null;
            /** Format: int64 */
            memberCount: number;
            alreadyMember: boolean;
            /** Format: uuid */
            groupId?: string | null;
        };
        IpLocation: {
            city?: string | null;
            country?: string | null;
            countryCode?: string | null;
        };
        ItemDto: {
            /** Format: uuid */
            id: string;
            type: components["schemas"]["ItemType"];
            title: string;
            /**
             * Format: uuid
             * @description `None` when the subject was typed in by hand instead of picked.
             */
            subjectId?: string | null;
            /** Format: uuid */
            courseId?: string | null;
            /** @description A `common.subjects.*` key or the name the group owner typed. */
            subjectName: string;
            courseName?: string | null;
            /** @description Whether the member takes the task's course. */
            takesCourse: boolean;
            description: string;
            attachments: components["schemas"]["AttachmentDto"][];
            /** Format: date-time */
            dueDate: string;
            /**
             * Format: uuid
             * @description `None` once the creator deleted their account.
             */
            createdBy?: string | null;
            /** @description The creator's pseudonym, the same in every group. */
            createdByName?: string | null;
            /** @description Only for superadmins, who need it to follow up on reports. */
            createdByEmail?: string | null;
            timeColor: components["schemas"]["TimeColor"];
            editorNote: string;
            /** Format: date-time */
            createdAt: string;
            /** Format: date-time */
            updatedAt: string;
        };
        ItemIdsDto: {
            itemIds: string[];
        };
        ItemListDto: {
            items: components["schemas"]["ItemDto"][];
            /**
             * @description How many tasks a personalized list left out because they belong to
             *     courses the member does not take.
             */
            hiddenByCourses: number;
        };
        /**
         * @description What a task is about: a subject of the group, optionally narrowed to one of
         *     its courses, or a subject typed in by hand that the group does not offer.
         */
        ItemSubjectDto: {
            /** Format: uuid */
            subjectId: string;
            /** Format: uuid */
            courseId?: string | null;
        } | {
            customName: string;
        };
        /** @enum {string} */
        ItemType: "homework" | "dalton" | "exam";
        /** @description A lesson of the weekly timetable. */
        LessonDto: {
            /** Format: uuid */
            id: string;
            /**
             * Format: int32
             * @description 1 for Monday to 5 for Friday.
             */
            day: number;
            /** Format: int32 */
            slot: number;
            /**
             * Format: int32
             * @description How many slots the lesson spans.
             */
            duration: number;
            room?: string | null;
            /** Format: uuid */
            subjectId?: string | null;
            subjectName?: string | null;
            /**
             * Format: uuid
             * @description Set when the lesson belongs to one course of its subject only.
             */
            courseId?: string | null;
            courseName?: string | null;
            isDalton: boolean;
        };
        LinkedProviderDto: {
            provider: string;
            /** @description The address the provider account belongs to. */
            email: string;
        };
        /** @enum {string} */
        Locale: "de" | "en";
        LoginDto: {
            email: string;
            password: string;
        };
        MarkAnnouncementsReadDto: {
            /** @description Clearing all sends every unread id at once. */
            ids: string[];
        };
        /**
         * @description A member's role as clients see it. Ownership lives in `groups.owner_id`
         *     rather than `user_roles`, so it is folded in here to keep the single-owner
         *     invariant enforced by the schema instead of by a second role row.
         * @enum {string}
         */
        MemberRole: "owner" | "admin" | "moderator" | "user";
        MetricPoint: [
            number,
            number | null
        ];
        /** @description What the second-factor step of a sign-in may offer. */
        MfaChallengeDto: {
            /**
             * Format: int64
             * @description Seconds left to finish the sign-in.
             */
            expiresIn: number;
            passkeyAvailable: boolean;
        };
        MfaCodeDto: {
            code: string;
        };
        /** @description A new authenticator secret, valid until confirmed with a code from it. */
        MfaSetupDto: {
            otpauthUrl: string;
            /** @description Base32, for typing into an authenticator app by hand. */
            secret: string;
            /** Format: date-time */
            expiresAt: string;
        };
        MfaSignInDto: {
            /** @description Set when a recovery code was used, so the client can warn early. */
            recoveryCodesLeft?: number | null;
        };
        MfaStatusDto: {
            mfaEnabled: boolean;
            /** @description Only while two-factor authentication is on. */
            recoveryCodesLeft?: number | null;
        };
        /** @enum {string} */
        NowMarkerTime: "remaining" | "duration";
        /** @enum {string} */
        Outcome: "success" | "failure";
        /**
         * @description A started passkey check: the options for the browser and the id to finish
         *     it with.
         */
        PasskeyChallengeDto: {
            /** Format: uuid */
            challengeId: string;
            options: unknown;
        };
        PasskeyList: {
            passkeys: components["schemas"]["PasskeySummary"][];
            rpId: string;
            /** @description The user handle the passkeys carry, base64url-encoded. */
            userHandle: string;
        };
        PasskeyReauthDto: {
            /** Format: uuid */
            challengeId: string;
            credential: unknown;
        };
        PasskeyRegistrationDto: {
            options: unknown;
        };
        PasskeySummary: {
            /** Format: uuid */
            id: string;
            name: string;
            /** Format: date-time */
            createdAt: string;
            /** Format: date-time */
            lastUsedAt?: string | null;
            /**
             * @description Base64url, as the browser reports it, so the client can tell the
             *     passkey manager which credentials still exist.
             */
            credentialId: string;
        };
        PasswordReauthDto: {
            password: string;
            secondFactor?: components["schemas"]["SecondFactorProof"] | null;
        };
        /** @enum {string} */
        Permission: "edit_group_profile" | "edit_group_configuration" | "edit_subjects_courses" | "edit_schedule" | "create_items" | "upload_images" | "manage_notes" | "manage_schedule_changes" | "manage_announcements" | "moderate_members" | "edit_other_content" | "delete_other_content" | "invite_members";
        /**
         * @description Something every user sees.
         * @enum {string}
         */
        PlatformTopic: "systemAnnouncements" | "access";
        /**
         * @description The settings as stored. Settings the user never changed are absent, and
         *     the client applies its defaults for them.
         */
        PreferencesDto: {
            /** @default null */
            theme: components["schemas"]["Theme"] | null;
            /** @default null */
            language: components["schemas"]["Locale"] | null;
            /** @default {} */
            tasks: components["schemas"]["TaskPreferencesDto"];
            /** @default {} */
            schedule: components["schemas"]["SchedulePreferencesDto"];
            /** @default {} */
            dashboard: components["schemas"]["DashboardPreferencesDto"];
            /** @default [] */
            dismissedNotices: components["schemas"]["DismissibleNotice"][];
        };
        ReauthStatus: {
            methods: components["schemas"]["SignInMethods"];
            /**
             * Format: date-time
             * @description Until when the last confirmation still counts; `None` once it lapsed.
             */
            recentUntil?: string | null;
        };
        /** @description Shown this once; only their hashes are stored. */
        RecoveryCodesDto: {
            recoveryCodes: string[];
        };
        RegisterDto: {
            email: string;
            password: string;
            acceptedTerms: boolean;
            preferences?: components["schemas"]["RegisterPreferencesDto"];
        };
        RegisterPreferencesDto: {
            theme?: components["schemas"]["Theme"];
            language?: components["schemas"]["Locale"];
        };
        RenamePasskeyDto: {
            name: string;
        };
        /** @description Moves a private task between the two neighbours it is dropped between. */
        ReorderTodoDto: {
            prevPosition?: string | null;
            nextPosition?: string | null;
        };
        ReplaceScheduleDto: {
            lessons: components["schemas"]["ScheduleLessonDto"][];
            scheduleConfig: components["schemas"]["ScheduleConfigDto"];
        };
        ReportDto: components["schemas"]["ReportedTaskDto"] & {
            /** Format: uuid */
            id: string;
            reportType: string;
            reason?: string | null;
            /** Format: uuid */
            reportedBy?: string | null;
            reporterEmail?: string | null;
            /** Format: date-time */
            reportedAt: string;
            /** @description The reported task no longer exists; only its snapshot is left. */
            contentDeleted: boolean;
        };
        ReportItemDto: {
            /** Format: uuid */
            itemId: string;
            reason?: string | null;
        };
        /**
         * @description The reported task as it was when reported, so the report still shows it
         *     after the task is gone. Snapshots taken by earlier versions lack some
         *     fields, which is why most of them may be missing.
         */
        ReportedTaskDto: {
            /** Format: uuid */
            itemId: string;
            itemTitle?: string;
            itemType?: components["schemas"]["ItemType"] | null;
            itemSubject?: string;
            itemCourse?: string | null;
            itemDescription?: string;
            itemAttachments?: components["schemas"]["FileDto"][];
            /** Format: date-time */
            itemDueDate?: string | null;
            itemEditorNote?: string;
            /** Format: uuid */
            itemTenantId?: string | null;
            creatorEmail?: string | null;
        };
        ResendVerificationDto: {
            email: string;
        };
        ResetPasswordDto: {
            resetToken: string;
            password: string;
        };
        ResetPasswordVerifyDto: {
            email: string;
            code: components["schemas"]["EmailCode"];
        };
        ResetTokenDto: {
            /** @description Sent along with the new password. */
            resetToken: string;
        };
        /**
         * @description Cloudinary keeps images, which it can transform on delivery, apart from raw
         *     files, which it serves as they are.
         * @enum {string}
         */
        ResourceType: "image" | "raw";
        /** @enum {string} */
        Role: "superadmin" | "admin" | "moderator" | "user";
        /** @description The body for both posting and rescheduling an announcement. */
        SaveSystemAnnouncementDto: {
            content: string;
            important?: boolean;
            /**
             * Format: date-time
             * @description Omitted to publish right away.
             */
            startsAt?: string | null;
            /**
             * Format: date-time
             * @description Omitted to show the announcement until it is deleted.
             */
            endsAt?: string | null;
        };
        /** @description When the school day starts and how its slots and breaks are laid out. */
        ScheduleConfigDto: {
            /** @description `HH:MM` */
            startTime: string;
            /** Format: int32 */
            totalSlots: number;
            /** Format: int32 */
            lessonDurationMins: number;
            /** @description Minutes of break after a slot, on every day without breaks of its own. */
            breaks?: {
                [key: string]: number;
            };
            /** @description The days whose breaks differ, each with all of its breaks. */
            dayBreaks?: {
                [key: string]: {
                    [key: string]: number;
                };
            };
        };
        ScheduleDto: {
            lessons: components["schemas"]["LessonDto"][];
            /**
             * @description How many lessons a personalized timetable left out because they belong
             *     to courses the member does not take.
             */
            hiddenByCourses: number;
        };
        ScheduleLessonDto: {
            /**
             * Format: uuid
             * @description Left out for a new lesson.
             */
            id?: string | null;
            /** Format: int32 */
            day: number;
            /** Format: int32 */
            slot: number;
            /** Format: int32 */
            duration: number;
            room?: string | null;
            /** Format: uuid */
            subjectId?: string | null;
            /** Format: uuid */
            courseId?: string | null;
            isDalton?: boolean;
        };
        SchedulePreferencesDto: {
            highlightNextLesson?: boolean | null;
            nowMarker?: boolean | null;
            nowMarkerTime?: components["schemas"]["NowMarkerTime"] | null;
            includeBreaksInFreeTime?: boolean | null;
        };
        /**
         * @description The one change a lesson carries in one week, replacing whatever change it
         *     had that week before.
         */
        ScheduleSubDto: {
            /** Format: uuid */
            lessonId: string;
            weekStart: components["schemas"]["WeekStart"];
            /** Format: uuid */
            courseId?: string | null;
            /** Format: int32 */
            day?: number | null;
            /** Format: int32 */
            slot?: number | null;
            /** Format: int32 */
            duration?: number | null;
            subject?: string | null;
            room?: string | null;
            cancelled?: boolean | null;
        };
        /** @description Authenticator app (TOTP) and passkeys, each on its own or both. */
        SecondFactorBreakdown: {
            /** Format: int64 */
            neither: number;
            /** Format: int64 */
            mfaOnly: number;
            /** Format: int64 */
            passkeyOnly: number;
            /** Format: int64 */
            both: number;
        };
        /**
         * @description What the user offers as their second factor, sent as `{ "code": "…" }` or
         *     `{ "recoveryCode": "…" }`.
         */
        SecondFactorProof: {
            code: string;
        } | {
            recoveryCode: string;
        };
        /**
         * @description The window is sent along so charts span all of it, even where the series
         *     start late or have gaps.
         */
        ServerMetricsDto: {
            /** Format: int64 */
            start: number;
            /** Format: int64 */
            end: number;
            /** Format: u-int32 */
            cpuCores: number;
            cpu: components["schemas"]["MetricPoint"][];
            networkIn: components["schemas"]["MetricPoint"][];
            networkOut: components["schemas"]["MetricPoint"][];
        };
        SessionInfo: {
            /** Format: uuid */
            familyId: string;
            /** Format: date-time */
            issuedAt: string;
            /** Format: date-time */
            lastUsedAt: string;
            userAgent?: string | null;
            ipAddress?: string | null;
            location?: components["schemas"]["IpLocation"] | null;
        };
        SessionListDto: {
            sessions: components["schemas"]["SessionInfo"][];
            /**
             * Format: uuid
             * @description The session the request was made in.
             */
            currentFamilyId: string;
        };
        SetPasswordDto: {
            code: components["schemas"]["EmailCode"];
            newPassword: string;
        };
        SignInDto: {
            /** Format: uuid */
            challengeId: string;
            credential: unknown;
        };
        SignInMethods: {
            password: boolean;
            passkeys: number;
            google: boolean;
            /** @description Not a way to sign in, but what each of them asks for in addition. */
            twoFactor: boolean;
        };
        SignInResultDto: {
            /** @description The password was right; the second factor is asked next. */
            requiresMfa: boolean;
        };
        StatsDto: {
            /** Format: int64 */
            userCount: number;
            /**
             * Format: int64
             * @description Sign-ups whose link has not been opened yet; they are no accounts.
             */
            pendingSignUps: number;
            /** Format: int64 */
            adminCount: number;
            /** Format: int64 */
            bannedCount: number;
            /** Format: int64 */
            newUsersThisWeek: number;
            /** Format: int64 */
            activeUsersThisWeek: number;
            /** Format: int64 */
            itemCount: number;
            /** Format: int64 */
            newItemsThisWeek: number;
            /** Format: int64 */
            reportCount: number;
        };
        /**
         * @description How members pick a subject's courses. Both sets describe how a member picks
         *     a course, never how a course is graded.
         * @enum {string}
         */
        SubjectCategory: "core" | "elective" | "extra" | "mandatory" | "optional" | "zk";
        SubjectDto: {
            /** Format: uuid */
            id: string;
            /** @description A `common.subjects.*` key or the name the group owner typed. */
            name: string;
            category: components["schemas"]["SubjectCategory"];
            isDalton: boolean;
            courses: components["schemas"]["CourseDto"][];
        };
        /** @description A change to one week: a lesson cancelled, moved or added. */
        SubstitutionDto: {
            /** Format: uuid */
            id: string;
            /**
             * Format: uuid
             * @description The regular lesson it changes.
             */
            lessonId: string;
            /** Format: uuid */
            courseId?: string | null;
            /** Format: date */
            weekStart: string;
            /** Format: int32 */
            day?: number | null;
            /** Format: int32 */
            slot?: number | null;
            /** Format: int32 */
            duration?: number | null;
            subject?: string | null;
            room?: string | null;
            cancelled: boolean;
            /** Format: date-time */
            createdAt: string;
        };
        /** @description A running announcement a user has yet to read. */
        SystemAnnouncementDto: {
            /** Format: uuid */
            id: string;
            content: string;
            important: boolean;
            /** Format: date-time */
            publishedAt: string;
        };
        /** @enum {string} */
        SystemAnnouncementStatus: "scheduled" | "active";
        TaskPreferencesDto: {
            archiveChecked?: components["schemas"]["ArchiveCheckedTasks"] | null;
            groupByDueDate?: boolean | null;
            archiveOtherCoursesPastDue?: boolean | null;
        };
        /**
         * @description The colour scheme a user picked; `System` follows the device.
         * @enum {string}
         */
        Theme: "system" | "light" | "dark";
        /**
         * @description How close a task is to its due date.
         * @enum {string}
         */
        TimeColor: "expired" | "danger" | "warn" | "normal" | "ok";
        /** @description Creates a private task or replaces the text of an existing one. */
        TodoContentDto: {
            title: string;
            description?: string | null;
        };
        /** @description A private task, decrypted for its owner. */
        TodoDto: {
            /** Format: uuid */
            id: string;
            title: string;
            description: string;
            completed: boolean;
            /** @description A fractional index; the list is sorted by it. */
            position: string;
            /** Format: date-time */
            createdAt: string;
            /** Format: date-time */
            updatedAt: string;
        };
        TodoMovedDto: {
            /** Format: uuid */
            id: string;
            position: string;
            /** Format: date-time */
            updatedAt: string;
        };
        TodoToggledDto: {
            /** Format: uuid */
            id: string;
            completed: boolean;
            /** Format: date-time */
            updatedAt: string;
        };
        TransferOwnershipDto: {
            /** Format: uuid */
            targetUserId: string;
        };
        /**
         * @description Each switch is changed only when sent, so two admins flipping different
         *     switches at once never undo each other. Serialized as is for the audit log.
         */
        UpdateAccessControlsDto: {
            registrationPaused?: boolean | null;
            shutdown?: boolean | null;
        };
        /** @description A course keeps its type when none is sent. */
        UpdateCourseDto: {
            name: string;
            courseType?: components["schemas"]["CourseType"] | null;
        };
        /** @description An empty note removes the current one. */
        UpdateEditorNoteDto: {
            editorNote: string;
        };
        /** @description Only the permissions to change; the others keep their current role. */
        UpdateGroupPermissionsDto: {
            permissions: {
                [key: string]: components["schemas"]["Role"];
            };
        };
        /** @description Only the sent settings change. */
        UpdateGroupSettingsDto: {
            name?: string | null;
            /**
             * Format: uuid
             * @description An upload from `/uploads/group-avatar`; `null` removes the picture.
             */
            avatarId?: string | null;
            groupType?: components["schemas"]["GroupType"] | null;
            daltonEnabled?: boolean | null;
        };
        UpdateItemDto: {
            title?: string | null;
            subject?: components["schemas"]["ItemSubjectDto"] | null;
            description?: string | null;
            /** Format: date-time */
            dueDate?: string | null;
        };
        UpdatePersonalizationDto: {
            personalized: boolean;
        };
        /**
         * @description The settings a request changes; omitted ones keep their stored value. Every
         *     field has a closed type, so the stored preferences stay small and readable
         *     by whatever reads them.
         */
        UpdatePreferencesDto: {
            theme?: components["schemas"]["Theme"] | null;
            language?: components["schemas"]["Locale"] | null;
            tasks?: components["schemas"]["TaskPreferencesDto"] | null;
            schedule?: components["schemas"]["SchedulePreferencesDto"] | null;
            dashboard?: components["schemas"]["DashboardPreferencesDto"] | null;
        };
        UpdateSetupDto: {
            courses: components["schemas"]["CourseSelectionDto"][];
        };
        UpdateSubjectDto: {
            name?: string | null;
            category?: components["schemas"]["SubjectCategory"] | null;
            isDalton?: boolean | null;
        };
        /**
         * @description A file uploaded for a task that is not attached yet. Its `id` is what the
         *     uploader sends to attach it.
         */
        UploadDto: components["schemas"]["FileDto"] & {
            /** Format: uuid */
            id: string;
        };
        /** @description The multipart form every upload sends: the file in a field named `file`. */
        UploadForm: {
            /** Format: binary */
            file: Blob;
        };
        UserMembershipDto: {
            /** Format: uuid */
            groupId: string;
            groupName: string;
            role: components["schemas"]["MemberRole"];
            /** Format: date-time */
            joinedAt: string;
            /** @description Promoting a muted member lifts the mute. */
            muted: boolean;
            assignableRoles: components["schemas"]["MemberRole"][];
        };
        VisibilityDto: {
            archived: string[];
            kept: string[];
        };
        /**
         * @description Where a member moved a task against its natural place: into the archive,
         *     or kept in the list although it would have been archived.
         * @enum {string}
         */
        VisibilityStatus: "archived" | "kept";
        VisibilityStatusDto: {
            status: components["schemas"]["VisibilityStatus"];
        };
        /**
         * Format: date
         * @description A school week, named by its Monday. Any other day is rejected while
         *     deserializing, so a week can only ever be named one way.
         */
        WeekStart: string;
        /**
         * @description When in the week the app is used, in German local time. Each cell counts a
         *     user at most once per day, so one person reloading the app all evening
         *     does not outweigh a class opening it once.
         */
        WeeklyRhythmDto: {
            /**
             * Format: int32
             * @description Whole weeks the counts span, so every hour of the week is sampled equally often.
             */
            weeks: number;
            /** @description Rows run Monday to Sunday, columns from 0:00 to 23:00. */
            activeUsers: number[][];
        };
        /**
         * @description The rows of a list from an offset on, with how many match in all, so the
         *     client can size its scrollbar before it has loaded everything.
         */
        Window_AdminGroupDto: {
            items: {
                /** Format: uuid */
                id: string;
                name: string;
                avatarUrl?: string | null;
                groupType: components["schemas"]["GroupType"];
                /** Format: uuid */
                ownerId: string;
                ownerEmail: string;
                ownerName: string;
                /** Format: date-time */
                createdAt: string;
                /**
                 * Format: date-time
                 * @description Set while the group is banned.
                 */
                bannedAt?: string | null;
                /** Format: int64 */
                memberCount: number;
                /** Format: int64 */
                itemCount: number;
            }[];
            /** Format: int64 */
            total: number;
        };
        /**
         * @description The rows of a list from an offset on, with how many match in all, so the
         *     client can size its scrollbar before it has loaded everything.
         */
        Window_AdminUserDto: {
            items: {
                /** Format: uuid */
                id: string;
                email: string;
                username: string;
                mfaEnabled: boolean;
                isSuperadmin: boolean;
                isBanned: boolean;
                /** Format: date-time */
                createdAt: string;
                /** Format: date-time */
                lastLoginAt?: string | null;
            }[];
            /** Format: int64 */
            total: number;
        };
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type AccessControls = components['schemas']['AccessControls'];
export type AccessStatusDto = components['schemas']['AccessStatusDto'];
export type AccountSecurityDto = components['schemas']['AccountSecurityDto'];
export type AccountTopic = components['schemas']['AccountTopic'];
export type AddAttachmentDto = components['schemas']['AddAttachmentDto'];
export type AdminGroupDto = components['schemas']['AdminGroupDto'];
export type AdminSystemAnnouncementDto = components['schemas']['AdminSystemAnnouncementDto'];
export type AdminUserDto = components['schemas']['AdminUserDto'];
export type AnnouncementDto = components['schemas']['AnnouncementDto'];
export type ArchiveCheckedTasks = components['schemas']['ArchiveCheckedTasks'];
export type AttachmentDto = components['schemas']['AttachmentDto'];
export type BannedMemberDto = components['schemas']['BannedMemberDto'];
export type ChangeMemberRoleDto = components['schemas']['ChangeMemberRoleDto'];
export type ChangeMembershipRoleDto = components['schemas']['ChangeMembershipRoleDto'];
export type ChangePasswordDto = components['schemas']['ChangePasswordDto'];
export type CleanupJobDto = components['schemas']['CleanupJobDto'];
export type ConfirmSignUpDto = components['schemas']['ConfirmSignUpDto'];
export type CourseDto = components['schemas']['CourseDto'];
export type CourseSelectionDto = components['schemas']['CourseSelectionDto'];
export type CourseSetup = components['schemas']['CourseSetup'];
export type CourseType = components['schemas']['CourseType'];
export type CreateAnnouncementDto = components['schemas']['CreateAnnouncementDto'];
export type CreateCourseDto = components['schemas']['CreateCourseDto'];
export type CreateGroupDto = components['schemas']['CreateGroupDto'];
export type CreateItemDto = components['schemas']['CreateItemDto'];
export type CreateSubjectDto = components['schemas']['CreateSubjectDto'];
export type CreatedDto = components['schemas']['CreatedDto'];
export type CurrentUserDto = components['schemas']['CurrentUserDto'];
export type DailyActivityDto = components['schemas']['DailyActivityDto'];
export type DailyEmailsDto = components['schemas']['DailyEmailsDto'];
export type DashboardPreferencesDto = components['schemas']['DashboardPreferencesDto'];
export type DataArchive = components['schemas']['DataArchive'];
export type DismissibleNotice = components['schemas']['DismissibleNotice'];
export type EditorNoteDto = components['schemas']['EditorNoteDto'];
export type EmailActivityDto = components['schemas']['EmailActivityDto'];
export type EmailCode = components['schemas']['EmailCode'];
export type EmailQuotaDto = components['schemas']['EmailQuotaDto'];
export type ErrorBody = components['schemas']['ErrorBody'];
export type ErrorCode = components['schemas']['ErrorCode'];
export type Event = components['schemas']['Event'];
export type EventLogEntryDto = components['schemas']['EventLogEntryDto'];
export type EventLogPage = components['schemas']['EventLogPage'];
export type EventSource = components['schemas']['EventSource'];
export type FileDto = components['schemas']['FileDto'];
export type FinishRegistrationDto = components['schemas']['FinishRegistrationDto'];
export type ForgotPasswordDto = components['schemas']['ForgotPasswordDto'];
export type GoogleAuthUrlDto = components['schemas']['GoogleAuthUrlDto'];
export type GoogleBreakdown = components['schemas']['GoogleBreakdown'];
export type GoogleSignUpDto = components['schemas']['GoogleSignUpDto'];
export type GroupAvatarUploadDto = components['schemas']['GroupAvatarUploadDto'];
export type GroupInviteDto = components['schemas']['GroupInviteDto'];
export type GroupMemberDto = components['schemas']['GroupMemberDto'];
export type GroupPermissions = components['schemas']['GroupPermissions'];
export type GroupStatusDto = components['schemas']['GroupStatusDto'];
export type GroupSummaryDto = components['schemas']['GroupSummaryDto'];
export type GroupTopic = components['schemas']['GroupTopic'];
export type GroupType = components['schemas']['GroupType'];
export type HealthDto = components['schemas']['HealthDto'];
export type InviteAcceptedDto = components['schemas']['InviteAcceptedDto'];
export type InviteCreatedDto = components['schemas']['InviteCreatedDto'];
export type InvitePreviewDto = components['schemas']['InvitePreviewDto'];
export type IpLocation = components['schemas']['IpLocation'];
export type ItemDto = components['schemas']['ItemDto'];
export type ItemIdsDto = components['schemas']['ItemIdsDto'];
export type ItemListDto = components['schemas']['ItemListDto'];
export type ItemSubjectDto = components['schemas']['ItemSubjectDto'];
export type ItemType = components['schemas']['ItemType'];
export type LessonDto = components['schemas']['LessonDto'];
export type LinkedProviderDto = components['schemas']['LinkedProviderDto'];
export type Locale = components['schemas']['Locale'];
export type LoginDto = components['schemas']['LoginDto'];
export type MarkAnnouncementsReadDto = components['schemas']['MarkAnnouncementsReadDto'];
export type MemberRole = components['schemas']['MemberRole'];
export type MetricPoint = components['schemas']['MetricPoint'];
export type MfaChallengeDto = components['schemas']['MfaChallengeDto'];
export type MfaCodeDto = components['schemas']['MfaCodeDto'];
export type MfaSetupDto = components['schemas']['MfaSetupDto'];
export type MfaSignInDto = components['schemas']['MfaSignInDto'];
export type MfaStatusDto = components['schemas']['MfaStatusDto'];
export type NowMarkerTime = components['schemas']['NowMarkerTime'];
export type Outcome = components['schemas']['Outcome'];
export type PasskeyChallengeDto = components['schemas']['PasskeyChallengeDto'];
export type PasskeyList = components['schemas']['PasskeyList'];
export type PasskeyReauthDto = components['schemas']['PasskeyReauthDto'];
export type PasskeyRegistrationDto = components['schemas']['PasskeyRegistrationDto'];
export type PasskeySummary = components['schemas']['PasskeySummary'];
export type PasswordReauthDto = components['schemas']['PasswordReauthDto'];
export type Permission = components['schemas']['Permission'];
export type PlatformTopic = components['schemas']['PlatformTopic'];
export type PreferencesDto = components['schemas']['PreferencesDto'];
export type ReauthStatus = components['schemas']['ReauthStatus'];
export type RecoveryCodesDto = components['schemas']['RecoveryCodesDto'];
export type RegisterDto = components['schemas']['RegisterDto'];
export type RegisterPreferencesDto = components['schemas']['RegisterPreferencesDto'];
export type RenamePasskeyDto = components['schemas']['RenamePasskeyDto'];
export type ReorderTodoDto = components['schemas']['ReorderTodoDto'];
export type ReplaceScheduleDto = components['schemas']['ReplaceScheduleDto'];
export type ReportDto = components['schemas']['ReportDto'];
export type ReportItemDto = components['schemas']['ReportItemDto'];
export type ReportedTaskDto = components['schemas']['ReportedTaskDto'];
export type ResendVerificationDto = components['schemas']['ResendVerificationDto'];
export type ResetPasswordDto = components['schemas']['ResetPasswordDto'];
export type ResetPasswordVerifyDto = components['schemas']['ResetPasswordVerifyDto'];
export type ResetTokenDto = components['schemas']['ResetTokenDto'];
export type ResourceType = components['schemas']['ResourceType'];
export type Role = components['schemas']['Role'];
export type SaveSystemAnnouncementDto = components['schemas']['SaveSystemAnnouncementDto'];
export type ScheduleConfigDto = components['schemas']['ScheduleConfigDto'];
export type ScheduleDto = components['schemas']['ScheduleDto'];
export type ScheduleLessonDto = components['schemas']['ScheduleLessonDto'];
export type SchedulePreferencesDto = components['schemas']['SchedulePreferencesDto'];
export type ScheduleSubDto = components['schemas']['ScheduleSubDto'];
export type SecondFactorBreakdown = components['schemas']['SecondFactorBreakdown'];
export type SecondFactorProof = components['schemas']['SecondFactorProof'];
export type ServerMetricsDto = components['schemas']['ServerMetricsDto'];
export type SessionInfo = components['schemas']['SessionInfo'];
export type SessionListDto = components['schemas']['SessionListDto'];
export type SetPasswordDto = components['schemas']['SetPasswordDto'];
export type SignInDto = components['schemas']['SignInDto'];
export type SignInMethods = components['schemas']['SignInMethods'];
export type SignInResultDto = components['schemas']['SignInResultDto'];
export type StatsDto = components['schemas']['StatsDto'];
export type SubjectCategory = components['schemas']['SubjectCategory'];
export type SubjectDto = components['schemas']['SubjectDto'];
export type SubstitutionDto = components['schemas']['SubstitutionDto'];
export type SystemAnnouncementDto = components['schemas']['SystemAnnouncementDto'];
export type SystemAnnouncementStatus = components['schemas']['SystemAnnouncementStatus'];
export type TaskPreferencesDto = components['schemas']['TaskPreferencesDto'];
export type Theme = components['schemas']['Theme'];
export type TimeColor = components['schemas']['TimeColor'];
export type TodoContentDto = components['schemas']['TodoContentDto'];
export type TodoDto = components['schemas']['TodoDto'];
export type TodoMovedDto = components['schemas']['TodoMovedDto'];
export type TodoToggledDto = components['schemas']['TodoToggledDto'];
export type TransferOwnershipDto = components['schemas']['TransferOwnershipDto'];
export type UpdateAccessControlsDto = components['schemas']['UpdateAccessControlsDto'];
export type UpdateCourseDto = components['schemas']['UpdateCourseDto'];
export type UpdateEditorNoteDto = components['schemas']['UpdateEditorNoteDto'];
export type UpdateGroupPermissionsDto = components['schemas']['UpdateGroupPermissionsDto'];
export type UpdateGroupSettingsDto = components['schemas']['UpdateGroupSettingsDto'];
export type UpdateItemDto = components['schemas']['UpdateItemDto'];
export type UpdatePersonalizationDto = components['schemas']['UpdatePersonalizationDto'];
export type UpdatePreferencesDto = components['schemas']['UpdatePreferencesDto'];
export type UpdateSetupDto = components['schemas']['UpdateSetupDto'];
export type UpdateSubjectDto = components['schemas']['UpdateSubjectDto'];
export type UploadDto = components['schemas']['UploadDto'];
export type UploadForm = components['schemas']['UploadForm'];
export type UserMembershipDto = components['schemas']['UserMembershipDto'];
export type VisibilityDto = components['schemas']['VisibilityDto'];
export type VisibilityStatus = components['schemas']['VisibilityStatus'];
export type VisibilityStatusDto = components['schemas']['VisibilityStatusDto'];
export type WeekStart = components['schemas']['WeekStart'];
export type WeeklyRhythmDto = components['schemas']['WeeklyRhythmDto'];
export type WindowAdminGroupDto = components['schemas']['Window_AdminGroupDto'];
export type WindowAdminUserDto = components['schemas']['Window_AdminUserDto'];
export type $defs = Record<string, never>;
export interface operations {
    list_announcements: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                group_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AnnouncementDto"][];
                };
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    mark_announcements_read: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                group_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["MarkAnnouncementsReadDto"];
            };
        };
        responses: {
            /** @description No Content */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    create_announcement: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                group_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateAnnouncementDto"];
            };
        };
        responses: {
            /** @description Created */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AnnouncementDto"];
                };
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    delete_announcement: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                group_id: string;
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description No Content */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    get_group: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                group_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["GroupSummaryDto"];
                };
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    delete_group: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                group_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description No Content */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    record_visit: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                group_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description No Content */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    leave_group: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                group_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description No Content */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    get_members: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                group_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["GroupMemberDto"][];
                };
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    create_invite: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                group_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Created */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["InviteCreatedDto"];
                };
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    get_banned_users: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                group_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BannedMemberDto"][];
                };
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    revert_ban: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                group_id: string;
                user_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description No Content */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    get_invites: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                group_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["GroupInviteDto"][];
                };
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    revoke_invite: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                group_id: string;
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description No Content */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    change_member_role: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                group_id: string;
                user_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ChangeMemberRoleDto"];
            };
        };
        responses: {
            /** @description No Content */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    mute_member: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                group_id: string;
                user_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description No Content */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    unmute_member: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                group_id: string;
                user_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description No Content */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    remove_member: {
        parameters: {
            query?: {
                /** @description Also keeps the member from joining again. */
                ban?: boolean;
            };
            header?: never;
            path: {
                group_id: string;
                user_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description No Content */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    transfer_ownership: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                group_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["TransferOwnershipDto"];
            };
        };
        responses: {
            /** @description No Content */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    update_group_settings: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                group_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateGroupSettingsDto"];
            };
        };
        responses: {
            /** @description No Content */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    get_permissions: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                group_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["GroupPermissions"];
                };
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    update_permissions: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                group_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateGroupPermissionsDto"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["GroupPermissions"];
                };
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    get_subjects_admin: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                group_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SubjectDto"][];
                };
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    create_subject: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                group_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateSubjectDto"];
            };
        };
        responses: {
            /** @description Created */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SubjectDto"];
                };
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    delete_subject: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                group_id: string;
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description No Content */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    update_subject: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                group_id: string;
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateSubjectDto"];
            };
        };
        responses: {
            /** @description No Content */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    create_course: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                group_id: string;
                subject_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateCourseDto"];
            };
        };
        responses: {
            /** @description Created */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CourseDto"];
                };
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    delete_course: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                group_id: string;
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description No Content */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    update_course: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                group_id: string;
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateCourseDto"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CourseDto"];
                };
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    get_schedule_admin: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                group_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ScheduleDto"];
                };
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    replace_schedule_admin: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                group_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ReplaceScheduleDto"];
            };
        };
        responses: {
            /** @description No Content */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    get_schedule_subs_admin: {
        parameters: {
            query?: {
                from?: components["schemas"]["WeekStart"];
                to?: components["schemas"]["WeekStart"];
            };
            header?: never;
            path: {
                group_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SubstitutionDto"][];
                };
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    save_schedule_sub: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                group_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ScheduleSubDto"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SubstitutionDto"];
                };
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    delete_schedule_sub: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                group_id: string;
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description No Content */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    get_items: {
        parameters: {
            query?: {
                /** @description Every type when left out. */
                type?: components["schemas"]["ItemType"];
                /** @description The archive instead of the current tasks. */
                archived?: boolean;
                subjectId?: string;
                hideChecked?: boolean;
                /** @description Leaves out tasks of courses the member does not take. */
                personalized?: boolean;
            };
            header?: never;
            path: {
                group_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ItemListDto"];
                };
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    create_item: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                group_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateItemDto"];
            };
        };
        responses: {
            /** @description Created */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CreatedDto"];
                };
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    report_item: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                group_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ReportItemDto"];
            };
        };
        responses: {
            /** @description No Content */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    get_item_by_id: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                group_id: string;
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ItemDto"];
                };
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    delete_item: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                group_id: string;
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description No Content */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    update_item: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                group_id: string;
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateItemDto"];
            };
        };
        responses: {
            /** @description No Content */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    update_item_note: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                group_id: string;
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateEditorNoteDto"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EditorNoteDto"];
                };
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    add_attachment: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                group_id: string;
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AddAttachmentDto"];
            };
        };
        responses: {
            /** @description Created */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AttachmentDto"];
                };
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    remove_attachment: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                group_id: string;
                id: string;
                attachment_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description No Content */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    get_schedule: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                group_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ScheduleDto"];
                };
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    get_subs: {
        parameters: {
            query?: {
                from?: components["schemas"]["WeekStart"];
                to?: components["schemas"]["WeekStart"];
            };
            header?: never;
            path: {
                group_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SubstitutionDto"][];
                };
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    get_subjects: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                group_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SubjectDto"][];
                };
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    reset_setup: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                group_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description No Content */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    update_setup: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                group_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateSetupDto"];
            };
        };
        responses: {
            /** @description No Content */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    set_visibility: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                group_id: string;
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["VisibilityStatusDto"];
            };
        };
        responses: {
            /** @description No Content */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    remove_visibility: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                group_id: string;
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description No Content */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    check_item: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                group_id: string;
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description No Content */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    uncheck_item: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                group_id: string;
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description No Content */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    pin_item: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                group_id: string;
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description No Content */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    unpin_item: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                group_id: string;
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description No Content */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    health: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HealthDto"];
                };
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    csrf_init: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description No Content */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    get_access_status: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AccessStatusDto"];
                };
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    list_system_announcements: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SystemAnnouncementDto"][];
                };
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    mark_system_announcements_read: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["MarkAnnouncementsReadDto"];
            };
        };
        responses: {
            /** @description No Content */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    verify_mfa: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SecondFactorProof"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MfaSignInDto"];
                };
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    start_mfa_passkey: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PasskeyChallengeDto"];
                };
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    verify_mfa_passkey: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SignInDto"];
            };
        };
        responses: {
            /** @description No Content */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    register: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RegisterDto"];
            };
        };
        responses: {
            /** @description No Content */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    resend_verification: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ResendVerificationDto"];
            };
        };
        responses: {
            /** @description No Content */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    forgot_password: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ForgotPasswordDto"];
            };
        };
        responses: {
            /** @description No Content */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    login: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["LoginDto"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SignInResultDto"];
                };
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    confirm_sign_up: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ConfirmSignUpDto"];
            };
        };
        responses: {
            /** @description No Content */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    verify_reset_token: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ResetPasswordVerifyDto"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ResetTokenDto"];
                };
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    reset_password: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ResetPasswordDto"];
            };
        };
        responses: {
            /** @description No Content */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    request_password_setup_code: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description No Content */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    set_password: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SetPasswordDto"];
            };
        };
        responses: {
            /** @description No Content */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    get_mfa_challenge: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MfaChallengeDto"];
                };
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    cancel_mfa: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description No Content */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    get_me: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CurrentUserDto"] | null;
                };
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    delete_me: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description No Content */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    change_password: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ChangePasswordDto"];
            };
        };
        responses: {
            /** @description No Content */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    remove_password: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description No Content */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    get_sign_in_methods: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SignInMethods"];
                };
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    refresh: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description No Content */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    logout: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description No Content */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    logout_all: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description No Content */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    logout_all_others: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description No Content */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    list_sessions: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SessionListDto"];
                };
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    revoke_session: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                family_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description No Content */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    update_personalization: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdatePersonalizationDto"];
            };
        };
        responses: {
            /** @description No Content */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    update_preferences: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdatePreferencesDto"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PreferencesDto"];
                };
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    dismiss_notice: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                notice: components["schemas"]["DismissibleNotice"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description No Content */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    get_checks: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ItemIdsDto"];
                };
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    get_pins: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ItemIdsDto"];
                };
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    get_visibility: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["VisibilityDto"];
                };
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    log_page_load: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description No Content */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    export_data: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The archive */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/zip": components["schemas"]["DataArchive"];
                };
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    create_group: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateGroupDto"];
            };
        };
        responses: {
            /** @description Created */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CreatedDto"];
                };
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    get_groups_status: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["GroupStatusDto"];
                };
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    get_invite: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                token: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["InvitePreviewDto"];
                };
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    accept_invite: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                token: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["InviteAcceptedDto"];
                };
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    get_todos: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TodoDto"][];
                };
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    create_todo: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["TodoContentDto"];
            };
        };
        responses: {
            /** @description Created */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TodoDto"];
                };
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    update_todo: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["TodoContentDto"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TodoDto"];
                };
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    delete_todo: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description No Content */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    toggle_todo: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TodoToggledDto"];
                };
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    reorder_todo: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ReorderTodoDto"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TodoMovedDto"];
                };
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    activate: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["MfaCodeDto"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RecoveryCodesDto"];
                };
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    deactivate: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description No Content */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    regenerate_recovery_codes: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RecoveryCodesDto"];
                };
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    get_mfa_status: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MfaStatusDto"];
                };
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    setup: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MfaSetupDto"];
                };
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    initiate_google_oauth: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Redirect to Google */
            307: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    sign_up_with_google: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["GoogleSignUpDto"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SignInResultDto"];
                };
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    handle_google_callback: {
        parameters: {
            query?: {
                code?: string;
                state?: string;
                error?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Redirect into the app */
            307: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    start_google_link: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["GoogleAuthUrlDto"];
                };
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    unlink_google_account: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description No Content */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    get_linked_providers: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LinkedProviderDto"][];
                };
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    start_sign_in: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PasskeyChallengeDto"];
                };
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    finish_sign_in: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SignInDto"];
            };
        };
        responses: {
            /** @description No Content */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    start_registration: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PasskeyRegistrationDto"];
                };
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    finish_registration: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["FinishRegistrationDto"];
            };
        };
        responses: {
            /** @description Created */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PasskeySummary"];
                };
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    list_passkeys: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PasskeyList"];
                };
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    remove_passkey: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description No Content */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    rename_passkey: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RenamePasskeyDto"];
            };
        };
        responses: {
            /** @description No Content */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    get_reauth_status: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ReauthStatus"];
                };
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    confirm_with_password: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PasswordReauthDto"];
            };
        };
        responses: {
            /** @description No Content */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    start_passkey: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PasskeyChallengeDto"];
                };
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    confirm_with_passkey: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PasskeyReauthDto"];
            };
        };
        responses: {
            /** @description No Content */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    start_google: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["GoogleAuthUrlDto"];
                };
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    confirm_google_second_factor: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SecondFactorProof"];
            };
        };
        responses: {
            /** @description No Content */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    get_stats: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StatsDto"];
                };
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    get_daily_activity: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DailyActivityDto"][];
                };
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    get_weekly_rhythm: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["WeeklyRhythmDto"];
                };
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    get_account_security: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AccountSecurityDto"];
                };
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    get_server_metrics: {
        parameters: {
            query: {
                range: "1h" | "24h" | "7d" | "30d";
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ServerMetricsDto"];
                };
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    get_email_activity: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EmailActivityDto"];
                };
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    get_email_quota: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EmailQuotaDto"];
                };
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    get_cleanup_jobs: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CleanupJobDto"][];
                };
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    get_events: {
        parameters: {
            query?: {
                /** @description Entries about this account as well as those it caused. */
                userId?: string;
                source?: components["schemas"]["EventSource"];
                /** @description The part of a type before its first colon, such as `auth`. */
                category?: string;
                type?: string;
                outcome?: components["schemas"]["Outcome"];
                ip?: string;
                groupId?: string;
                /** @description Inclusive. */
                from?: string;
                /** @description Exclusive. */
                to?: string;
                search?: string;
                order?: "asc" | "desc";
                /** @description Where the previous page ended; left out for the first page. */
                cursor?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EventLogPage"];
                };
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    list_admin_groups: {
        parameters: {
            query?: {
                offset?: number;
                limit?: number;
                search?: string;
                type?: "all" | "regular" | "abitur";
                sort?: "createdAt" | "name" | "memberCount" | "itemCount";
                order?: "asc" | "desc";
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Window_AdminGroupDto"];
                };
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    get_admin_group: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AdminGroupDto"];
                };
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    delete_admin_group: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description No Content */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    ban_group: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description No Content */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    unban_group: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description No Content */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    list_admin_users: {
        parameters: {
            query?: {
                offset?: number;
                limit?: number;
                search?: string;
                status?: "all" | "active" | "banned" | "superadmin";
                sort?: "createdAt" | "lastLoginAt" | "email";
                order?: "asc" | "desc";
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Window_AdminUserDto"];
                };
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    get_admin_user: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AdminUserDto"];
                };
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    delete_admin_user: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description No Content */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    get_user_memberships: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UserMembershipDto"][];
                };
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    change_membership_role: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description The member. */
                id: string;
                group_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ChangeMembershipRoleDto"];
            };
        };
        responses: {
            /** @description No Content */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    ban_user: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description No Content */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    unban_user: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description No Content */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    reset_user_mfa: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description No Content */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    get_reports: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ReportDto"][];
                };
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    delete_report: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description No Content */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    list_admin_system_announcements: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AdminSystemAnnouncementDto"][];
                };
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    create_system_announcement: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SaveSystemAnnouncementDto"];
            };
        };
        responses: {
            /** @description Created */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CreatedDto"];
                };
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    update_system_announcement: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SaveSystemAnnouncementDto"];
            };
        };
        responses: {
            /** @description No Content */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    delete_system_announcement: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description No Content */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    get_access_controls: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AccessControls"];
                };
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    update_access_controls: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateAccessControlsDto"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AccessControls"];
                };
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    upload_attachment: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                group_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "multipart/form-data": components["schemas"]["UploadForm"];
            };
        };
        responses: {
            /** @description Created */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UploadDto"];
                };
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    upload_group_avatar: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "multipart/form-data": components["schemas"]["UploadForm"];
            };
        };
        responses: {
            /** @description Created */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["GroupAvatarUploadDto"];
                };
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
    events: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description One `Event` per message */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "text/event-stream": components["schemas"]["Event"];
                };
            };
            /** @description The request failed */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorBody"];
                };
            };
        };
    };
}
