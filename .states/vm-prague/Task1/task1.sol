// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract task1 {
    function binarySearch (uint[] memory arr, uint target) public pure returns(uint) {
        uint left = 0;
        uint right = arr.length -1;
        while (left <= right) {
            uint mid = left + (right - left)/2;
            if (arr[mid] == target) {
                return mid;
            } else if (arr[mid] < target) {
                left = mid + 1;
            } else {
                right = mid - 1;
            }
        }
        return arr.length; // 未找到
    }


    function reverseString (string memory str) public pure returns (string memory) {
        bytes memory bytesStr = bytes(str);  //将 string 转为 bytes
        bytes memory reversedBytes = new bytes(bytesStr.length);

        for (uint i = 0; i < bytesStr.length; i++) {
            reversedBytes[bytesStr.length - 1 - i] = bytesStr[i]; // 反转赋值
        }

        return string(reversedBytes); // 转回 string
    }

    /**
     * 用 solidity 实现罗马数字转数整数
     * 题目描述：将一个罗马数字转换为整数。输入 "MCMXCIV"，输出 1994
     */
    function romanToInt(string memory s) public pure returns (uint256) {
        // 将字符串转换为bytes数组以便访问单个字符
        bytes memory romanBytes = bytes(s);

        uint256 result = 0; // 存储最终的整数结果
        uint256 prevValue = 0; // 前一个罗马数字的数值

        // 从字符串的末尾开始遍历，使用int类型避免溢出
        for (int256 i = int256(romanBytes.length) - 1; i >= 0; i--) {
            bytes1 currentChar = romanBytes[uint256(i)]; // 当前罗马数字字符
            uint256 currentValue = getRomanValue(currentChar); // 获取当前罗马数字的数值

            // 如果当前数值小于前一个数值，说明是减法情况，需要减去当前数值
            if (currentValue < prevValue) {
                result -= currentValue;
            } else {
                result += currentValue;
            }

            prevValue = currentValue; // 更新前一个数值为当前数值
        }

        return result; // 返回转换后的整数结果
    }

    /**
     * 根据罗马数字字符返回对应的数值
     * @param romanChar 罗马数字字符
     * @return 对应的数值
     */
    function getRomanValue(bytes1 romanChar) private pure returns (uint256) {
        if (romanChar == "I") return 1;
        if (romanChar == "V") return 5;
        if (romanChar == "X") return 10;
        if (romanChar == "L") return 50;
        if (romanChar == "C") return 100;
        if (romanChar == "D") return 500;
        if (romanChar == "M") return 1000;
        return 0; // 无效字符返回0
    }


    /**
     * @dev 合并两个有序数组为一个有序数组
     * @param arr1 第一个有序数组
     * @param arr2 第二个有序数组
     * @return 合并后的有序数组
     */
    function mergeSortedArrays(uint[] memory arr1, uint[] memory arr2)
        public
        pure
        returns (uint[] memory)
    {
        uint len1 = arr1.length;
        uint len2 = arr2.length;
        uint[] memory merged = new uint[](len1 + len2); // 新数组长度为 len1 + len2

        uint i = 0; // arr1 的指针
        uint j = 0; // arr2 的指针
        uint k = 0; // merged 的指针

        // 遍历两个数组，比较元素并填入 merged
        while (i < len1 && j < len2) {
            if (arr1[i] <= arr2[j]) {
                merged[k] = arr1[i];
                i++;
            } else {
                merged[k] = arr2[j];
                j++;
            }
            k++;
        }

        // 将 arr1 剩余元素复制到 merged
        while (i < len1) {
            merged[k] = arr1[i];
            i++;
            k++;
        }

        // 将 arr2 剩余元素复制到 merged
        while (j < len2) {
            merged[k] = arr2[j];
            j++;
            k++;
        }

        return merged;
    }





}