// Qdrant support is not implemented in v0.4.
// This file exists to mark the interface extension point.
// To enable, implement VectorMemoryIndex using the Qdrant REST/gRPC client
// and switch via MEMORY_VECTOR_INDEX_PROVIDER=qdrant.

export {};
