// Thin server-function wrappers — module scope holds only imports, types and
// the exported declarations; all logic lives in hardcore.server.ts.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { Reps } from "./exercises";
import * as srv from "./hardcore.server";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const tokenSchema = z.object({ token: z.string().min(10) });
const sessionSchema = tokenSchema.extend({ today: dateSchema });
const repsSchema = z.object({
  pushups: z.number().int().min(0).max(99999).optional(),
  situps: z.number().int().min(0).max(99999).optional(),
  squats: z.number().int().min(0).max(99999).optional(),
  lunges: z.number().int().min(0).max(99999).optional(),
  glute_bridges: z.number().int().min(0).max(99999).optional(),
  leg_raises: z.number().int().min(0).max(99999).optional(),
  burpees: z.number().int().min(0).max(99999).optional(),
});

export const listMemberNames = createServerFn({ method: "GET" }).handler(() =>
  srv.listMemberNames(),
);

export const loginWithPin = createServerFn({ method: "POST" })
  .validator((data) =>
    z
      .object({ name: z.string().min(1).max(60), pin: z.string().regex(/^\d{4}$/) })
      .parse(data),
  )
  .handler(({ data }) => srv.login(data.name, data.pin));

export const signupWithPin = createServerFn({ method: "POST" })
  .validator((data) =>
    z
      .object({
        name: z.string().trim().min(1).max(30),
        pin: z.string().regex(/^\d{4}$/),
        today: dateSchema,
      })
      .parse(data),
  )
  .handler(({ data }) => srv.signup(data.name, data.pin, data.today));

export const validateSession = createServerFn({ method: "POST" })
  .validator((data) => sessionSchema.parse(data))
  .handler(({ data }) => srv.memberFromToken(data.token, data.today));

export const setMyGender = createServerFn({ method: "POST" })
  .validator((data) => tokenSchema.extend({ gender: z.enum(["man", "woman"]) }).parse(data))
  .handler(({ data }) => srv.setGender(data.token, data.gender));

export const getTodayBoard = createServerFn({ method: "POST" })
  .validator((data) => tokenSchema.extend({ date: dateSchema }).parse(data))
  .handler(({ data }) => srv.getBoard(data.token, data.date));

export const saveMyRecord = createServerFn({ method: "POST" })
  .validator((data) =>
    tokenSchema.extend({ date: dateSchema, reps: repsSchema }).parse(data),
  )
  .handler(({ data }) => srv.saveRecord(data.token, data.date, data.reps as Partial<Reps>));

export const getLeaderboard = createServerFn({ method: "POST" })
  .validator((data) =>
    tokenSchema
      .extend({ period: z.enum(["day", "month", "year"]), ref: dateSchema })
      .parse(data),
  )
  .handler(async ({ data }) => {
    await srv.memberFromToken(data.token, data.ref);
    return srv.getLeaderboard(data.period, data.ref);
  });

export const getMyHistory = createServerFn({ method: "POST" })
  .validator((data) => sessionSchema.parse(data))
  .handler(({ data }) => srv.getMyRecords(data.token, data.today));
