#include <iostream>
#include <algorithm>
#include <vector>

bool sorting (int i, int j) {
  return i > j; // desc
}

int main() {
  int n, k;
  int weight;
  int weights_sum = 0;
  int min_result;
  std::vector<int> goat_weights;
  std::cin >> n >> k;
  for (int i = 0; i < n; i++) {
    std::cin >> weight;
    goat_weights.push_back(weight);
    weights_sum += weight;
  }
  if (k == 1) {
    std::cout << weights_sum << std::endl;
  }
  // for (std::vector<int>::iterator it = goat_weights.begin(); it != goat_weights.end(); it++) {
  //   std::cout << *it << std::endl;
  // }
  std::sort(goat_weights.begin(), goat_weights.end(), sorting);
  min_result = goat_weights[0];
  
  // for (std::vector<int>::iterator it = goat_weights.begin(); it != goat_weights.end(); it++) {
  //   std::cout << *it << std::endl;
  // }


  return 0;
}
