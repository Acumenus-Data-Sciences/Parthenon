import api from '@/lib/api';
import type {
  DataInterrogationRequest,
  DataInterrogationResponse,
} from '../types/abby';

export async function askDataQuestion(
  request: DataInterrogationRequest,
): Promise<DataInterrogationResponse> {
  const { data } = await api.post<DataInterrogationResponse>(
    '/data-interrogation/ask',
    request,
    { timeout: 120_000 },
  );
  return data;
}
