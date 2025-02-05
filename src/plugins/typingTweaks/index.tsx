/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2023 Vendicated and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { definePluginSettings } from "@api/Settings";
import ErrorBoundary from "@components/ErrorBoundary";
import { Devs } from "@utils/constants";
import { openUserProfile } from "@utils/discord";
import definePlugin, { OptionType } from "@utils/types";
import { Avatar, GuildMemberStore, React, RelationshipStore } from "@webpack/common";
import { User } from "discord-types/general";
import { PropsWithChildren } from "react";

const settings = definePluginSettings({
    showAvatars: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Show avatars in the typing indicator"
    },
    showRoleColors: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Show role colors in the typing indicator"
    },
    alternativeFormatting: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Show a more useful message when several users are typing"
    }
});

export function buildSeveralUsers({ a, b, count }: { a: string, b: string, count: number; }) {
    return [
        <strong key="0">{a}</strong>,
        ", ",
        <strong key="1">{b}</strong>,
        `, and ${count} others are typing...`
    ];
}

interface Props {
    user: User;
    guildId: string;
}

const getUserColor = (userId: string, guildId: string) => {
    if (Vencord.Plugins.isPluginEnabled("IrcColors")) {
        // @ts-ignore
        const color = Vencord.Plugins.plugins?.IrcColors?.calculateNameColorForUser?.(userId);
        if (color) return color;
    }

    return GuildMemberStore.getMember(guildId, userId)?.colorString;
};
const TypingUser = ErrorBoundary.wrap(function ({ user, guildId }: Props) {
    return (
        <strong
            role="button"
            onClick={() => {
                openUserProfile(user.id);
            }}
            style={{
                display: "grid",
                gridAutoFlow: "column",
                gap: "4px",
                color: settings.store.showRoleColors ? getUserColor(user?.id, guildId) : undefined,
                cursor: "pointer"
            }}
        >
            {settings.store.showAvatars && (
                <div style={{ marginTop: "4px" }}>
                    <Avatar
                        size="SIZE_16"
                        src={user.getAvatarURL(guildId, 128)} />
                </div>
            )}
            {GuildMemberStore.getNick(guildId!, user.id)
                || (!guildId && RelationshipStore.getNickname(user.id))
                || (user as any).globalName
                || user.username
            }
        </strong>
    );
}, { noop: true });

export default definePlugin({
    name: "TypingTweaks",
    description: "Show avatars and role colours in the typing indicator",
    authors: [Devs.zt],
    settings,

    patches: [
        {
            find: "#{intl::THREE_USERS_TYPING}",
            replacement: [
                {
                    // Style the indicator and add function call to modify the children before rendering
                    match: /(?<=children:\[(\i)\.length>0.{0,200}?"aria-atomic":!0,children:)\i(?<=guildId:(\i).+?)/,
                    replace: "$self.renderTypingUsers({ users: $1, guildId: $2, children: $& }),style:$self.TYPING_TEXT_STYLE"
                },
                {
                    // Changes the indicator to keep the user object when creating the list of typing users
                    match: /\.map\((\i)=>\i\.\i\.getName\(\i,\i\.id,\1\)\)/,
                    replace: ""
                },
                {
                    // Adds the alternative formatting for several users typing
                    match: /(,{a:(\i),b:(\i),c:\i}\):\i\.length>3&&\(\i=)\i\.\i\.string\(\i\.\i#{intl::SEVERAL_USERS_TYPING}\)(?<=(\i)\.length.+?)/,
                    replace: (_, rest, a, b, users) => `${rest}$self.buildSeveralUsers({ a: ${a}, b: ${b}, count: ${users}.length - 2 })`,
                    predicate: () => settings.store.alternativeFormatting
                }
            ]
        }
    ],

    TYPING_TEXT_STYLE: {
        display: "grid",
        gridAutoFlow: "column",
        gridGap: "0.25em"
    },

    buildSeveralUsers,

    renderTypingUsers: ErrorBoundary.wrap(({ guildId, users, children }: PropsWithChildren<{ guildId: string, users: User[]; }>) => {
        try {
            if (!Array.isArray(children)) {
                return children;
            }

            let element = 0;

            return children.map(c => {
                if (c.type !== "strong" && !(typeof c !== "string" && !React.isValidElement(c)))
                    return c;

                const user = users[element++];
                return <TypingUser key={user.id} guildId={guildId} user={user} />;
            });
        } catch (e) {
            console.error(e);
        }

        return children;
    }, { noop: true })
});
