import { a, defineData } from '@aws-amplify/backend';
import type { ClientSchema } from '@aws-amplify/data-schema';

export const schema = defineData({
  models: {
    FavoriteCoin: a
      .model({
        symbol: a.string().required(),
        name: a.string().required(),
        addedAt: a.datetime().required()
      })
      .authorization((allow) => allow.allowPublicApiKey())
  }
});

export type Schema = ClientSchema<typeof schema>;
