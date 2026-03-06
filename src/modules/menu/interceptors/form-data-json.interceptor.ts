// form-data-json.interceptor.ts
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from "@nestjs/common";
import { Observable } from "rxjs";

@Injectable()
export class FormDataJsonInterceptor implements NestInterceptor {
  private readonly jsonFields = ["variations", "addons", "tags"];

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context
      .switchToHttp()
      .getRequest<{ body: Record<string, unknown> }>();

    const body = request.body;

    if (body && typeof body === "object") {
      for (const field of this.jsonFields) {
        const value = body[field];
        if (typeof value === "string") {
          try {
            const parsed: unknown = JSON.parse(value);
            body[field] = Array.isArray(parsed) ? parsed : [];
          } catch {
            body[field] = [];
          }
        }
      }
    }

    return next.handle();
  }
}
