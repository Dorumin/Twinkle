export type JSONArray = JSONValue[];
export type JSONObject = { [k: string]: JSONValue };
export type JSONValue = null | boolean | number | string | JSONArray | JSONObject;
