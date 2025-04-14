#include <cstdarg>
#include <cstdint>
#include <cstdlib>
#include <ostream>
#include <new>

/// 100 MiB limit on gRPC messages, set to be the same as the API server.
constexpr static const uintptr_t MAX_MESSAGE_SIZE = ((100 * 1024) * 1024);

extern "C" {

/// Add two numbers.
void add_two_numbers(int32_t x, int32_t y);

}  // extern "C"
