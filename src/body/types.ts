export type BodyState = {
  emotion: string;
  expression: string;
  motion: string;
  voiceStyle: string;
  mouthSync: "idle" | "speaking";
  idleBehavior: string;
  attention: string;
};

export type BodyAdapter = {
  id: string;
  displayName: string;
  kind: "placeholder" | "svg-rig" | "live2d" | "custom";
  mapState: (aiState: Record<string, unknown>) => BodyState;
};
