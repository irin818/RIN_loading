import type { CubismIdHandle } from "./vendor/live2d-cubism-framework/id/cubismid";
import type { CubismMatrix44 } from "./vendor/live2d-cubism-framework/math/cubismmatrix44";
import type { CubismModelMatrix } from "./vendor/live2d-cubism-framework/math/cubismmodelmatrix";
import type { CubismMoc } from "./vendor/live2d-cubism-framework/model/cubismmoc";
import type { CubismModel } from "./vendor/live2d-cubism-framework/model/cubismmodel";
import type { CubismRenderer_WebGL } from "./vendor/live2d-cubism-framework/rendering/cubismrenderer_webgl";

import type { BodyRuntimeState } from "./types";

type Model3Json = {
  FileReferences?: {
    Moc?: string;
    Textures?: string[];
  };
};

const coreScriptPromises = new Map<string, Promise<void>>();
const RUNTIME_ASSET_BASE_URL = `${window.location.origin}/`;
const CUBISM_SHADER_PATH = resolveRuntimeAssetUrl("/live2d/cubism-framework/Shaders/WebGL/");
const LIVE2D_RESOURCE_TIMEOUT_MS = 8000;
let frameworkStarted = false;
let frameworkRuntimePromise: Promise<CubismRuntime> | null = null;

type CubismRuntime = {
  CubismFramework: typeof import("./vendor/live2d-cubism-framework/live2dcubismframework").CubismFramework;
  Option: typeof import("./vendor/live2d-cubism-framework/live2dcubismframework").Option;
  CubismMatrix44: typeof import("./vendor/live2d-cubism-framework/math/cubismmatrix44").CubismMatrix44;
  CubismModelMatrix: typeof import("./vendor/live2d-cubism-framework/math/cubismmodelmatrix").CubismModelMatrix;
  CubismMoc: typeof import("./vendor/live2d-cubism-framework/model/cubismmoc").CubismMoc;
  CubismRenderer_WebGL: typeof import("./vendor/live2d-cubism-framework/rendering/cubismrenderer_webgl").CubismRenderer_WebGL;
  CubismShaderManager_WebGL: typeof import("./vendor/live2d-cubism-framework/rendering/cubismshader_webgl").CubismShaderManager_WebGL;
};

export class RinOfficialCubismModel {
  public loaded = false;

  private readonly gl: WebGLRenderingContext;
  private readonly renderer: CubismRenderer_WebGL;
  private readonly moc: CubismMoc;
  private readonly model: CubismModel;
  private readonly textures: WebGLTexture[];
  private readonly modelMatrix: CubismModelMatrix;
  private readonly runtime: CubismRuntime;
  private readonly parameterIds = new Map<string, CubismIdHandle>();
  private animationFrame: number | null = null;
  private state: BodyRuntimeState;
  private startedAt = performance.now();
  private disposed = false;
  private frameBuffer: WebGLFramebuffer | null;

  private constructor(options: {
    gl: WebGLRenderingContext;
    renderer: CubismRenderer_WebGL;
    moc: CubismMoc;
    model: CubismModel;
    textures: WebGLTexture[];
    state: BodyRuntimeState;
    runtime: CubismRuntime;
  }) {
    this.gl = options.gl;
    this.renderer = options.renderer;
    this.moc = options.moc;
    this.model = options.model;
    this.textures = options.textures;
    this.state = options.state;
    this.runtime = options.runtime;
    this.frameBuffer = this.gl.getParameter(this.gl.FRAMEBUFFER_BINDING) as WebGLFramebuffer | null;
    this.modelMatrix = new this.runtime.CubismModelMatrix(
      this.model.getCanvasWidth(),
      this.model.getCanvasHeight()
    );
    this.modelMatrix.setHeight(1.82);
    this.modelMatrix.setCenterPosition(0, -0.04);
  }

  static async create(options: {
    canvas: HTMLCanvasElement;
    modelPath: string;
    coreScriptPath: string;
    state: BodyRuntimeState;
  }): Promise<RinOfficialCubismModel> {
    const coreScriptPath = resolveRuntimeAssetUrl(options.coreScriptPath);
    const modelPath = resolveRuntimeAssetUrl(options.modelPath);

    await loadCubismCoreScript(coreScriptPath);
    const runtime = await loadFrameworkRuntime();
    startCubismFramework(runtime);

    const modelResponse = await fetchWithTimeout(modelPath, `Timed out while loading Live2D model manifest: ${modelPath}`);
    if (!modelResponse.ok) {
      throw new Error(`Failed to load Live2D model manifest: ${modelResponse.status}`);
    }
    const modelJson = (await modelResponse.json()) as Model3Json;
    const mocReference = modelJson.FileReferences?.Moc;
    const textureReferences = modelJson.FileReferences?.Textures ?? [];
    if (!mocReference || textureReferences.length === 0) {
      throw new Error("Live2D model manifest is missing Moc or texture references.");
    }

    const modelBase = modelPath.slice(0, modelPath.lastIndexOf("/") + 1);
    const mocPath = resolveModelReference(modelBase, mocReference);
    const mocResponse = await fetchWithTimeout(
      mocPath,
      `Timed out while loading Live2D moc: ${mocPath}`
    );
    if (!mocResponse.ok) {
      throw new Error(`Failed to load Live2D moc: ${mocResponse.status}`);
    }
    const mocBytes = await mocResponse.arrayBuffer();
    const moc = runtime.CubismMoc.create(mocBytes, true);
    if (!moc) {
      throw new Error("Cubism Core rejected the Live2D moc.");
    }
    const model = moc.createModel();
    if (!model) {
      runtime.CubismMoc.delete(moc);
      throw new Error("Cubism Core could not create a Live2D model.");
    }
    model.saveParameters();

    const gl = getWebGlContext(options.canvas);
    const textures = await Promise.all(
      textureReferences.map((reference) =>
        loadTexture(gl, resolveModelReference(modelBase, reference))
      )
    );
    const renderer = new runtime.CubismRenderer_WebGL(
      options.canvas.width,
      options.canvas.height
    );
    renderer.initialize(model);
    renderer.startUp(gl);
    renderer.setIsPremultipliedAlpha(true);
    renderer.loadShaders(CUBISM_SHADER_PATH);
    await waitForCubismShaders(runtime, gl);
    textures.forEach((texture, index) => renderer.bindTexture(index, texture));

    const instance = new RinOfficialCubismModel({
      gl,
      renderer,
      moc,
      model,
      textures,
      state: options.state,
      runtime,
    });
    instance.loaded = true;
    instance.start();
    return instance;
  }

  resize(width: number, height: number): void {
    this.renderer.setRenderTargetSize(width, height);
  }

  setState(state: BodyRuntimeState): void {
    this.state = state;
  }

  destroy(): void {
    this.disposed = true;
    if (this.animationFrame !== null) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
    this.renderer.release();
    this.textures.forEach((texture) => this.gl.deleteTexture(texture));
    this.moc.deleteModel(this.model);
    this.runtime.CubismMoc.delete(this.moc);
    this.loaded = false;
  }

  private start(): void {
    const loop = () => {
      if (this.disposed) {
        return;
      }
      this.draw();
      this.animationFrame = requestAnimationFrame(loop);
    };
    loop();
  }

  private draw(): void {
    const elapsedSeconds = (performance.now() - this.startedAt) / 1000;
    applyVisualState(this.model, this.getParameterId.bind(this), this.state, elapsedSeconds);
    this.model.update();

    this.gl.viewport(0, 0, this.gl.canvas.width, this.gl.canvas.height);
    this.gl.clearColor(0, 0, 0, 0);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
    this.gl.enable(this.gl.BLEND);
    this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);

    const projection = new this.runtime.CubismMatrix44();
    const canvas = this.gl.canvas as HTMLCanvasElement;
    if (canvas.width > canvas.height) {
      projection.scale(canvas.height / canvas.width, 1);
    } else {
      projection.scale(1, canvas.width / canvas.height);
    }
    projection.multiplyByMatrix(this.modelMatrix);
    this.renderer.setMvpMatrix(projection);
    this.renderer.setRenderState(this.frameBuffer as WebGLFramebuffer, [
      0,
      0,
      canvas.width,
      canvas.height,
    ]);
    this.renderer.drawModel(CUBISM_SHADER_PATH);
  }

  private getParameterId(id: string): CubismIdHandle {
    const existing = this.parameterIds.get(id);
    if (existing) {
      return existing;
    }
    const handle = this.runtime.CubismFramework.getIdManager().getId(id);
    this.parameterIds.set(id, handle);
    return handle;
  }
}

function loadCubismCoreScript(src: string): Promise<void> {
  if (typeof Live2DCubismCore !== "undefined") {
    return Promise.resolve();
  }
  const existing = coreScriptPromises.get(src);
  if (existing) {
    return existing;
  }
  const promise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    const timeout = window.setTimeout(() => {
      script.remove();
      reject(new Error("Timed out while loading Cubism Core script."));
    }, LIVE2D_RESOURCE_TIMEOUT_MS);
    script.src = src;
    script.async = true;
    script.onload = () => {
      window.clearTimeout(timeout);
      resolve();
    };
    script.onerror = () => {
      window.clearTimeout(timeout);
      reject(new Error("Failed to load Cubism Core script."));
    };
    document.head.appendChild(script);
  }).then(() => {
    if (typeof Live2DCubismCore === "undefined") {
      throw new Error("Cubism Core script loaded without a global runtime.");
    }
  });
  coreScriptPromises.set(src, promise);
  return promise;
}

function loadFrameworkRuntime(): Promise<CubismRuntime> {
  if (!frameworkRuntimePromise) {
    frameworkRuntimePromise = Promise.all([
      import("./vendor/live2d-cubism-framework/live2dcubismframework"),
      import("./vendor/live2d-cubism-framework/math/cubismmatrix44"),
      import("./vendor/live2d-cubism-framework/math/cubismmodelmatrix"),
      import("./vendor/live2d-cubism-framework/model/cubismmoc"),
      import("./vendor/live2d-cubism-framework/rendering/cubismrenderer_webgl"),
      import("./vendor/live2d-cubism-framework/rendering/cubismshader_webgl"),
    ]).then(
      ([
        frameworkModule,
        matrixModule,
        modelMatrixModule,
        mocModule,
        rendererModule,
        shaderModule,
      ]) => ({
        CubismFramework: frameworkModule.CubismFramework,
        Option: frameworkModule.Option,
        CubismMatrix44: matrixModule.CubismMatrix44,
        CubismModelMatrix: modelMatrixModule.CubismModelMatrix,
        CubismMoc: mocModule.CubismMoc,
        CubismRenderer_WebGL: rendererModule.CubismRenderer_WebGL,
        CubismShaderManager_WebGL: shaderModule.CubismShaderManager_WebGL,
      })
    );
  }
  return frameworkRuntimePromise;
}

function waitForCubismShaders(
  runtime: CubismRuntime,
  gl: WebGLRenderingContext
): Promise<void> {
  const startedAt = performance.now();
  return new Promise((resolve, reject) => {
    const poll = () => {
      const shader = runtime.CubismShaderManager_WebGL.getInstance().getShader(gl) as
        | {
            _isShaderLoaded?: boolean;
            _isShaderLoading?: boolean;
            _shaderSets?: Array<{ shaderProgram?: WebGLProgram | number | null }>;
          }
        | undefined;
      if (
        shader?._isShaderLoaded === true &&
        shader._shaderSets?.some((set) => set?.shaderProgram)
      ) {
        resolve();
        return;
      }
      if (performance.now() - startedAt > 5000) {
        reject(new Error("Timed out while loading official Cubism WebGL shaders."));
        return;
      }
      window.setTimeout(poll, 50);
    };
    poll();
  });
}

function startCubismFramework(runtime: CubismRuntime): void {
  if (frameworkStarted) {
    return;
  }
  const option = new runtime.Option();
  option.logFunction = (message: string) => {
    if (window.location.hostname === "127.0.0.1") {
      console.info(message);
    }
  };
  option.loggingLevel = 1;
  runtime.CubismFramework.startUp(option);
  runtime.CubismFramework.initialize();
  frameworkStarted = true;
}

function resolveModelReference(base: string, reference: string): string {
  return new URL(reference, base).toString();
}

function resolveRuntimeAssetUrl(path: string): string {
  return new URL(path, RUNTIME_ASSET_BASE_URL).toString();
}

function getWebGlContext(canvas: HTMLCanvasElement): WebGLRenderingContext {
  const gl = canvas.getContext("webgl", {
    alpha: true,
    premultipliedAlpha: true,
    antialias: true,
  });
  if (!gl) {
    throw new Error("WebGL is not available for Live2D rendering.");
  }
  return gl;
}

async function loadTexture(gl: WebGLRenderingContext, url: string): Promise<WebGLTexture> {
  const source = await withTimeout(loadTextureSource(url), LIVE2D_RESOURCE_TIMEOUT_MS, `Timed out while loading Live2D texture: ${url}`);
  const texture = gl.createTexture();
  if (!texture) {
    closeTextureSource(source);
    throw new Error("Failed to create a Live2D WebGL texture.");
  }
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 1);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.bindTexture(gl.TEXTURE_2D, null);
  closeTextureSource(source);
  return texture;
}

async function loadTextureSource(url: string): Promise<TexImageSource> {
  if ("createImageBitmap" in window) {
    const response = await fetchWithTimeout(
      url,
      `Timed out while loading Live2D texture: ${url}`
    );
    if (!response.ok) {
      throw new Error(`Failed to load Live2D texture ${url}: HTTP ${response.status}`);
    }
    return await createImageBitmap(await response.blob());
  }
  return await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    const timeout = window.setTimeout(() => {
      image.src = "";
      reject(new Error(`Timed out while loading Live2D texture: ${url}`));
    }, LIVE2D_RESOURCE_TIMEOUT_MS);
    image.onload = () => {
      window.clearTimeout(timeout);
      resolve(image);
    };
    image.onerror = () => {
      window.clearTimeout(timeout);
      reject(new Error(`Failed to load Live2D texture: ${url}`));
    };
    image.src = url;
  });
}

function closeTextureSource(source: TexImageSource): void {
  if ("close" in source && typeof source.close === "function") {
    source.close();
  }
}

async function fetchWithTimeout(url: string, message: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), LIVE2D_RESOURCE_TIMEOUT_MS);
  try {
    return await fetch(url, { signal: controller.signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(message);
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error(message)), timeoutMs);
    promise.then(
      (value) => {
        window.clearTimeout(timeout);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timeout);
        reject(error);
      }
    );
  });
}

function applyVisualState(
  model: CubismModel,
  getId: (id: string) => CubismIdHandle,
  state: BodyRuntimeState,
  elapsedSeconds: number
): void {
  const intensity = Math.max(0, Math.min(1, state.intensity));
  const slowPulse = Math.sin(elapsedSeconds * 1.5);
  const attention = state.activity === "listening" ? -10 : state.activity === "thinking" ? 10 : 0;
  const warning = state.activity === "warning" || state.activity === "error" ? 1 : 0;
  const mouth = state.speechState === "speaking" ? 0.45 + Math.max(0, slowPulse) * 0.35 : 0.04;
  const blink = 0.75 + Math.sin(elapsedSeconds * 0.65) * 0.18;

  setParameter(model, getId("ParamAngleX"), attention * intensity);
  setParameter(model, getId("ParamAngleY"), warning ? -4 : Math.sin(elapsedSeconds * 0.35) * 2.5);
  setParameter(model, getId("ParamAngleZ"), warning ? -4 : Math.sin(elapsedSeconds * 0.42) * 2);
  setParameter(model, getId("ParamBodyAngleX"), attention * 0.45 * intensity);
  setParameter(model, getId("ParamEyeLOpen"), Math.max(0.2, blink));
  setParameter(model, getId("ParamEyeROpen"), Math.max(0.2, blink));
  setParameter(model, getId("ParamMouthOpenY"), mouth);
  setParameter(model, getId("ParamBreath"), 0.5 + slowPulse * 0.22);
}

function setParameter(
  model: CubismModel,
  id: CubismIdHandle,
  value: number
): void {
  try {
    model.setParameterValueById(id, value);
  } catch {
    // Early RIN exports may not contain all common Cubism parameters.
  }
}
