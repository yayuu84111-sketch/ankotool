import { type InsertCapture, type Capture } from "@shared/schema";

export interface IStorage {
  createCapture(capture: InsertCapture): Promise<Capture>;
  getCaptures(): Promise<Capture[]>;
}

export class MemStorage implements IStorage {
  private captures: Capture[] = [];
  private nextId = 1;

  async createCapture(insertCapture: InsertCapture): Promise<Capture> {
    const capture: Capture = {
      id: this.nextId++,
      imageData: insertCapture.imageData,
      createdAt: new Date(),
    };
    this.captures.unshift(capture);
    return capture;
  }

  async getCaptures(): Promise<Capture[]> {
    return this.captures;
  }
}

export const storage = new MemStorage();
